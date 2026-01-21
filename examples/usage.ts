import { TurboCsv } from '../src/index'; // In real usage: import { TurboCsv } from 'turbo-csv-stream';
import { z } from 'zod';
import * as fs from 'fs';
import * as path from 'path';

// 1. Define your strict Schema
// Using Zod allows coercion (string -> number) during parsing
const UserSchema = z.object({
  id: z.string().uuid().or(z.coerce.string()), // Accept UUID or cast string
  email: z.string().email(),
  age: z.coerce.number().min(18).max(120), // Automatically convert CSV string "25" to number 25
  isActive: z.coerce.boolean(), // Convert "true"/"1" to boolean
  createdAt: z.string(),
});

// Create a dummy big file for demonstration
const setupDummyFile = (filePath: string) => {
  const header = 'id,email,age,isActive,createdAt\n';
  const row1 = '123e4567-e89b-12d3-a456-426614174000,john@example.com,30,true,2023-01-01\n';
  const row2 = 'invalid-uuid,jane@example.com,12,false,2023-01-02\n'; // Invalid Age (<18)
  const row3 = '123e4567-e89b-12d3-a456-426614174002,bob@example.com,45,true,2023-01-03\n';
  
  if (!fs.existsSync(filePath)) {
    console.log('Generating dummy CSV file...');
    fs.writeFileSync(filePath, header);
    // Write 1000 rows
    for(let i=0; i<1000; i++) {
        fs.appendFileSync(filePath, row1);
        if (i % 50 === 0) fs.appendFileSync(filePath, row2); // Inject errors occasionally
        fs.appendFileSync(filePath, row3);
    }
  }
};

async function main() {
  const filePath = path.join(__dirname, 'large_dataset.csv');
  setupDummyFile(filePath);

  console.log('🚀 Starting TurboCSV Pipeline...');
  console.time('Pipeline Duration');

  // Initialize Pipeline
  const pipeline = TurboCsv.from(filePath)
    .schema(UserSchema) // Apply Zod validation
    .options({
      batchSize: 500, // Yield 500 rows at a time (great for bulk INSERT)
      errorThreshold: 100, // Allow up to 100 bad rows before crashing
    });

  let totalValid = 0;
  let totalInvalid = 0;

  try {
    // Consume the stream
    const generator = pipeline.process();
    if (generator) {
      for await (const batch of generator) {
      
        // Simulate Database Write
        if (batch.data.length > 0) {
          // await db.insert('users', batch.data); 
          totalValid += batch.data.length;
        }

        // Handle Errors (e.g., log to Dead Letter Queue file)
        if (batch.errors.length > 0) {
          batch.errors.forEach(err => {
              // console.warn(`Skipping line ${err.line}:`, err.error);
          });
          totalInvalid += batch.errors.length;
        }

        // Progress bar effect
        process.stdout.write(`\rProcessed: ${batch.processedCount} rows...`);
      }
    }

    console.log('\n\n✅ Pipeline Complete!');
    console.log(`Summary:`);
    console.log(`- Valid Rows: ${totalValid}`);
    console.log(`- Invalid Rows: ${totalInvalid} (skipped)`);
    
  } catch (error) {
    console.error('\n❌ Critical Pipeline Failure:', error);
  } finally {
    console.timeEnd('Pipeline Duration');
    // Cleanup dummy file
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }
}

main();
