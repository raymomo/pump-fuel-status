export const timeAgo = (t) => {
  if (!t) return '';
  const diff = Math.floor((Date.now() - new Date(t).getTime()) / 1000);
  if (diff < 60) return 'เมื่อสักครู่';
  if (diff < 3600) return `${Math.floor(diff / 60)} นาทีที่แล้ว`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} ชม.ที่แล้ว`;
  return `${Math.floor(diff / 86400)} วันที่แล้ว`;
};

export const formatTime = (t) => {
  if (!t) return '';
  return new Date(t).toLocaleString('th-TH', { dateStyle: 'short', timeStyle: 'medium' });
};
