import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import dotenv from 'dotenv';

dotenv.config();

const s3Client = new S3Client({
  region: 'eu-west-3',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  }
});

const bucketName = 'gustlayers';

async function uploadFileToS3(filename, base64EncodedCsv) {
  const decodedContent = Buffer.from(base64EncodedCsv, 'base64');
  const params = {
    Bucket: bucketName,
    Key: `csv/${filename}`,
    Body: decodedContent,
    ContentType: 'text/csv',
  };

  try {
    const command = new PutObjectCommand(params);
    const data = await s3Client.send(command);
    console.log(`File uploaded successfully. ETag: ${data.ETag}`);
  } catch (err) {
    console.error("Error uploading file:", err);
  }
}

async function uploadToS3(processedCsvContentsWithFilenames) {
  for (const item of processedCsvContentsWithFilenames) {
    const { csv_content, filename } = item;
    const base64EncodedCsv = Buffer.from(csv_content).toString('base64');
    await uploadFileToS3(filename, base64EncodedCsv);
  }
  console.log("All files uploaded successfully.");
}

export { uploadToS3 };
