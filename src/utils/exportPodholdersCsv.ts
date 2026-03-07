import RNFS from 'react-native-fs';
import Share from 'react-native-share';

/**
 * Export podholders as CSV
 * Columns: Serial Number, Model
 */
export const exportPodholdersCsv = async (podholders: any[]) => {
  try {
    if (!podholders || podholders.length === 0) {
      console.log('❌ No podholders to export');
      return;
    }

    // CSV HEADER
    const headers = ['Podholder Serial Number', 'Podholder Device ID', 'Club', 'Pod Serial Number', 'Pod Device ID', 'Pod Assigned Date'];
    const allRows: { data: string, timestamp: number }[] = [];

    podholders.forEach(h => {
      const pods = h.pods || [];
      const phSerial = h.serial_number ?? '';
      const phDevice = h.device_id ?? '---';
      const club = h.club?.club_name ?? 'Unassigned';

      const commonFields = [phSerial, phDevice, club];

      if (pods.length === 0) {
        const rowData = [...commonFields, 'No Pods', '---', '---'];
        allRows.push({
          data: rowData.map(c => `"${String(c).replace(/"/g, '""')}"`).join(','),
          timestamp: new Date(h.updated_at || h.created_at).getTime()
        });
      } else {
        pods.forEach((p: any) => {
          const ts = p.updated_at || p.created_at;
          const assignedDate = ts ? new Date(ts).toLocaleDateString('en-GB') : '---';
          const isNew = ts && (Math.abs(Date.now() - new Date(ts).getTime()) < 24 * 60 * 60 * 1000);
          const tag = isNew ? '[NEW] ' : '';

          const podSerial = `${tag}${p.serial_number || 'N/A'}`;
          const podDevice = p.device_id || 'N/A';

          const rowData = [...commonFields, podSerial, podDevice, assignedDate];
          allRows.push({
            data: rowData.map(c => `"${String(c).replace(/"/g, '""')}"`).join(','),
            timestamp: ts ? new Date(ts).getTime() : 0
          });
        });
      }
    });

    // Sort by timestamp ascending (newest at the bottom)
    allRows.sort((a, b) => a.timestamp - b.timestamp);

    const csv = '\ufeff' + headers.join(',') + '\n' + allRows.map(r => r.data).join('\n');

    // FILE NAME
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `podholders_${timestamp}.csv`;
    const filePath = `${RNFS.DownloadDirectoryPath}/${fileName}`;

    // WRITE FILE
    await RNFS.writeFile(filePath, csv, 'utf8');
    console.log('✅ CSV saved at:', filePath);

    // SHARE / DOWNLOAD
    await Share.open({
      url: `file://${filePath}`,
      type: 'text/csv',
      filename: fileName,
      failOnCancel: false,
    });
  } catch (err: any) {
    if (err?.message?.includes('User did not share')) {
      console.log('ℹ User cancelled export');
      return;
    }
    console.error('❌ CSV Export failed:', err);
  }
};
