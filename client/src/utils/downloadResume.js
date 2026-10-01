const resolveUrl = (url) => {
  if (typeof url !== 'string') {
    return '';
  }

  const normalizedUrl = url.trim();

  return normalizedUrl.startsWith('http://') || normalizedUrl.startsWith('https://')
    ? normalizedUrl
    : '';
};

const buildSafeName = (name) =>
  (name || 'student')
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_]/g, '');

const buildSafeFileName = (fileName) => {
  const withoutExtension = String(fileName || 'resume')
    .replace(/\.pdf$/i, '')
    .toLowerCase()
    .replace(/\s+/g, '_')
    .replace(/[^a-z0-9_-]/g, '')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '');

  return `${withoutExtension || 'resume'}.pdf`;
};

export const buildResumeFilename = (name) => {
  if (typeof name === 'string' && /\.pdf$/i.test(name.trim())) {
    return buildSafeFileName(name);
  }

  return `${buildSafeName(name)}_resume.pdf`;
};

export default async function downloadResume(url, name) {
  const targetUrl = resolveUrl(url);

  if (!targetUrl) {
    return;
  }

  try {
    const response = await fetch(targetUrl);
    if (!response.ok) throw new Error('Network response was not ok');
    
    const blob = await response.blob();
    const blobUrl = window.URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = blobUrl;
    a.download = buildResumeFilename(name);
    
    document.body.appendChild(a);
    a.click();
    
    setTimeout(() => {
      document.body.removeChild(a);
      window.URL.revokeObjectURL(blobUrl);
    }, 100);
  } catch (err) {
    const newTab = window.open(targetUrl, '_blank', 'noopener,noreferrer');
    if (!newTab) {
      // Fallback if popup blocked
      window.location.href = targetUrl;
    }
  }
}

export { resolveUrl as resolveResumeUrl };
