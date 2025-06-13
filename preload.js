const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  selectExcelFile: () => ipcRenderer.invoke('select-excel-file'),
  extractChartData: (filePath, range) => ipcRenderer.invoke('extract-chart-data', filePath, range),
  saveExcelFile: (data) => ipcRenderer.invoke('save-excel-file', data)
});
