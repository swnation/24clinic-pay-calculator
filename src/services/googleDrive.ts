// Google Drive App Data storage service
// Uses Google Identity Services for OAuth2 + fetch for Drive API

const SCOPES = 'https://www.googleapis.com/auth/drive.appdata';
const DATA_FILENAME = '24clinic-pay-calculator.json';

declare const google: {
  accounts: {
    oauth2: {
      initTokenClient(config: {
        client_id: string;
        scope: string;
        callback: (response: { access_token?: string; error?: string }) => void;
      }): { requestAccessToken(): void };
      revoke(token: string, callback?: () => void): void;
    };
  };
};

let accessToken: string | null = null;

export function isSignedIn(): boolean {
  return accessToken !== null;
}

export function getAccessToken(): string | null {
  return accessToken;
}

export function signIn(clientId: string): Promise<string> {
  return new Promise((resolve, reject) => {
    if (typeof google === 'undefined') {
      reject(new Error('Google Identity Services가 로드되지 않았습니다.'));
      return;
    }

    const client = google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: SCOPES,
      callback: (response) => {
        if (response.error || !response.access_token) {
          reject(new Error(response.error || '로그인 실패'));
          return;
        }
        accessToken = response.access_token;
        resolve(response.access_token);
      },
    });

    client.requestAccessToken();
  });
}

export function signOut() {
  if (accessToken) {
    if (typeof google !== 'undefined') {
      google.accounts.oauth2.revoke(accessToken);
    }
    accessToken = null;
  }
}

async function findDataFile(): Promise<string | null> {
  if (!accessToken) return null;

  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files?spaces=appDataFolder&q=name='${DATA_FILENAME}'&fields=files(id,name,modifiedTime)`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!res.ok) {
    if (res.status === 401) { accessToken = null; }
    return null;
  }

  const data = await res.json();
  return data.files?.[0]?.id || null;
}

export async function loadFromDrive(): Promise<Record<string, unknown> | null> {
  if (!accessToken) return null;

  const fileId = await findDataFile();
  if (!fileId) return null;

  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );

  if (!res.ok) return null;
  return res.json();
}

export async function saveToDrive(data: Record<string, unknown>): Promise<boolean> {
  if (!accessToken) return false;

  const fileId = await findDataFile();
  const body = JSON.stringify(data);

  if (fileId) {
    // Update existing file
    const res = await fetch(
      `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=media`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
        body,
      }
    );
    return res.ok;
  } else {
    // Create new file
    const metadata = { name: DATA_FILENAME, parents: ['appDataFolder'] };
    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    form.append('file', new Blob([body], { type: 'application/json' }));

    const res = await fetch(
      'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
      {
        method: 'POST',
        headers: { Authorization: `Bearer ${accessToken}` },
        body: form,
      }
    );
    return res.ok;
  }
}
