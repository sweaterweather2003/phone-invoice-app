import { getAuthSync } from '../firebase';
import { API_URL } from './client';

export async function sendDocumentEmail(documentId: string) {
  const user = getAuthSync().currentUser;
  if (!user) throw new Error('Sign in before sending a document.');

  const token = await user.getIdToken();
  const response = await fetch(
    `${API_URL}/firebase/documents/${encodeURIComponent(documentId)}/send-email`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    }
  );
  const responseText = await response.text();
  let data: { error?: string; [key: string]: unknown } = {};

  if (responseText) {
    try {
      data = JSON.parse(responseText);
    } catch {
      if (response.status === 404) {
        throw new Error('The Render backend does not have the email endpoint yet. Deploy the latest backend code.');
      }
      throw new Error(
        `The email server returned an unexpected response (HTTP ${response.status}). Check the latest Render deployment.`
      );
    }
  }

  if (!response.ok) {
    throw new Error(data.error || `Could not send document email (${response.status}).`);
  }

  return data;
}
