import { handleUpload } from '@vercel/blob/client';

export default async function handler(request, response) {
  try {
    const body = typeof request.body === 'string' ? JSON.parse(request.body) : request.body;

    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        // Authenticate the user if needed, but for now we just return the payload
        // This authorizes the client to upload to Vercel Blob
        return {
          allowedContentTypes: ['application/pdf'],
          maximumSizeInBytes: 15 * 1024 * 1024, // 15MB limit
        };
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        // We will handle the indexing in the Python backend instead
        console.log('Blob upload completed', blob, tokenPayload);
      },
    });

    return response.status(200).json(jsonResponse);
  } catch (error) {
    console.error('Error generating token:', error);
    return response.status(400).json({ error: error.message });
  }
}
