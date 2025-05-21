document.getElementById('loadExcel').addEventListener('click', async () => {
    const data = await window.electronAPI.selectExcelFile();
    if (!data) return;
  
    const output = document.getElementById('output');
    output.innerHTML = '<h3>📄 데이터 미리보기</h3><pre>' + JSON.stringify(data.slice(0, 10), null, 2) + '</pre>';
  });
  