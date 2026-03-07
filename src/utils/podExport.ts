import RNFS from 'react-native-fs';
import Share from 'react-native-share';

export const downloadPods = async (pods: any[]) => {
  try {
    if (!pods || !pods.length) {
      console.log('❌ No pods to export');
      return;
    }

    // Headers
    const headers = ['Serial Number', 'Device ID', 'Model', 'Assigned Date'];

    // Sort pods by updated_at or created_at ascending (newest last)
    const sortedPods = [...pods].sort((a, b) => {
      const tsA = new Date(a.updated_at || a.created_at || a.created_at || 0).getTime();
      const tsB = new Date(b.updated_at || b.created_at || b.created_at || 0).getTime();
      return tsA - tsB;
    });

    const rows = sortedPods.map(p => {
      const ts = p.updated_at || p.created_at;
      const assignedDate = ts ? new Date(ts).toLocaleDateString('en-GB') : '---';
      const row = [
        p.serial || p.serial_number || '',
        p.deviceId || p.device_id || '---',
        p.model || 'Standard',
        assignedDate
      ];
      return row.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',');
    });

    const csv = '\ufeff' + headers.join(',') + '\n' + rows.join('\n');

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `pods_export_${timestamp}.csv`;
    const filePath = `${RNFS.DownloadDirectoryPath}/${fileName}`;

    // 1️⃣ write file
    await RNFS.writeFile(filePath, csv, 'utf8');
    console.log('✅ CSV written to:', filePath);

    // 4️⃣ open share dialog
    await Share.open({
      url: 'file://' + filePath,
      type: 'text/csv',
      filename: fileName,
      failOnCancel: false,
    });

  } catch (err: any) {
    if (err?.message?.includes('User did not share')) {
      console.log('ℹ User cancelled share');
      return;
    }
    console.error('❌ Download error:', err);
  }
};
