import { handleUpload } from '@vercel/blob/client';

export default async function handler(request, response) {
  try {
    const body = typeof request.body === 'string' ? JSON.parse(request.body) : request.body;

    const jsonResponse = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        // Authorize the client to upload to Vercel Blob
        return {
          allowedContentTypes: ['application/pdf'],
          maximumSizeInBytes: 10 * 1024 * 1024, // 10MB limit
        };
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        console.log('Blob upload completed', blob, tokenPayload);
      },
    });

    return response.status(200).json(jsonResponse);
  } catch (error) {
    console.error('Error generating token:', error);
    return response.status(400).json({ error: error.message });
  }
}
