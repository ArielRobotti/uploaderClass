import React, { useState } from 'react';
import { uploaderClass_backend } from 'declarations/uploaderClass_backend';

function App() {
  const [fileId, setFileId] = useState('');
  const [fileUrl, setFileUrl] = useState('');

  // Función para manejar la subida de archivos
  async function handleSubmit(event) {
    event.preventDefault();
    const file = event.target.elements.file.files[0];
    const file_name = file.name;
    const total_length = file.size;
    console.log(file);
    console.log(file_name, total_length);

    let { id, chunksQty, chunkSize } = await uploaderClass_backend.uploadRequest(file_name, total_length);
    console.log(id, chunksQty, chunkSize);
    const promises = [];

    for (let i = 0; i < Number(chunksQty); i++) {
      let start = i * Number(chunkSize);

      const chunk = file.slice(start, start + Number(chunkSize));
      const arrayBuffer = await chunk.arrayBuffer();
      const uint8Array = new Uint8Array(arrayBuffer);
      promises.push(uploaderClass_backend.addChunck(id, uint8Array, i));
    }
    const chunkIds = await Promise.all(promises);
    const commitResult = await uploaderClass_backend.commitLoad(id);
    console.log(commitResult);
    return false;
  }

  // Función para manejar la descarga de archivos
  async function handleDownload(event) {
    event.preventDefault();
    const { id } = event.target.elements;
    const fileId = id.value;

    // Obtener los metadatos del archivo
    const fileResponse = await uploaderClass_backend.startDownload(BigInt(fileId));
    console.log(fileResponse)
    if (fileResponse.Ok) {
      const file = fileResponse.Ok;
      const chunksQty = Number(file.chunks_qty);
      const promises = [];

      // Obtener todos los fragmentos
      for (let i = 0; i < chunksQty; i++) {
        promises.push(uploaderClass_backend.getChunck(BigInt(fileId), BigInt(i)));
      }

      const chunkResponses = await Promise.all(promises);
      
      const chunks = chunkResponses.map(response => response.Ok);

      // Reconstruir el archivo
      const blob = new Blob(chunks, { type: 'application/octet-stream' });
      const url = URL.createObjectURL(blob);
      setFileUrl(url);

      // Limpiar la URL del blob cuando ya no sea necesario
      return () => {
        URL.revokeObjectURL(url);
      };
    } else {
      console.error('Error downloading file:', fileResponse.err);
    }
  }

  return (
    <main>
      <h1>File Upload and Download</h1>
      
      {/* Formulario para subir archivo */}
      <form onSubmit={handleSubmit}>
        <input type="file" id='file' name='file' placeholder='Select file' required />
        <button type="submit">Load</button>
      </form>
      
      {/* Formulario para descargar archivo */}
      <form onSubmit={handleDownload}>
        <input type="text" name="id" placeholder="Enter File ID" required />
        <button type="submit">Download</button>
      </form>
      
      {/* Mostrar el archivo descargado si existe */}
      {fileUrl && (
        <>
          <img src={fileUrl} alt="Downloaded File" style={{ display: 'block', maxWidth: '100%' }} />
          <video controls src={fileUrl} style={{ display: 'block', maxWidth: '100%' }} />
          <a href={fileUrl} download="downloadedFile">Download File</a>
        </>
      )}
    </main>
  );
}

export default App;
