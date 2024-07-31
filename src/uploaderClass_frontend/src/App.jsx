import React, { useState } from 'react';
import { uploaderClass_backend } from 'declarations/uploaderClass_backend';
import { createTheme, ThemeProvider } from '@mui/material/styles';
import Container from '@mui/material/Container';
import CssBaseline from '@mui/material/CssBaseline';
import TextField from '@mui/material/TextField';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import CircularProgress from '@mui/material/CircularProgress';
import InputAdornment from '@mui/material/InputAdornment';
import IconButton from '@mui/material/IconButton';
import SearchIcon from '@mui/icons-material/Search';

const theme = createTheme({
  palette: {
    mode: 'dark',
    background: {
      default: '#121212',
    },
    primary: {
      main: '#90caf9',
    },
    secondary: {
      main: '#f48fb1',
    },
  },
});

function App() {
  const [fileUrl, setFileUrl] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(event) {
    event.preventDefault();
    setLoading(true);
    setError('');
    const file = event.target.elements.file.files[0];
    const fileName = file.name;
    const totalLength = file.size;

    try {
      let { id, chunksQty, chunkSize } = await uploaderClass_backend.uploadRequest(fileName, totalLength);
      const promises = [];

      for (let i = 0; i < Number(chunksQty); i++) {
        let start = i * Number(chunkSize);
        const chunk = file.slice(start, start + Number(chunkSize));
        
        const arrayBuffer = await chunk.arrayBuffer();
        const uint8Array = new Uint8Array(arrayBuffer);
        console.log("Subiendo ", uint8Array.length, " Bytes from Chunck Nro ", i );
        promises.push(uploaderClass_backend.addChunck(id, uint8Array, i));
      }
      await Promise.all(promises);
      const result = await uploaderClass_backend.commitLoad(id);
      console.log(result);
    } catch (err) {
      setError('Error uploading file. Please try again.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  async function handleDownload(event) {
    event.preventDefault();
    setLoading(true);
    setError('');
    const { id } = event.target.elements;
    const fileId = id.value;

    try {
      const fileResponse = await uploaderClass_backend.startDownload(BigInt(fileId));
      if (fileResponse.Ok) {
        const file = fileResponse.Ok;
        console.log(file);
        const chunksQty = Number(file.chunks_qty);
        const promises = [];

        for (let i = 0; i < chunksQty; i++) {
          console.log("Descargando chunk Nro ", i);
          promises.push(uploaderClass_backend.getChunck(BigInt(fileId), BigInt(i)));
        }

        const chunkResponses = await Promise.all(promises);
        const chunks = chunkResponses.map(response => response.Ok);

        const arrayBuffers = chunks.map(chunk => chunk.buffer);
        const combinedArrayBuffer = new Uint8Array(arrayBuffers.reduce((acc, buffer) => {
          const newBuffer = new Uint8Array(acc.length + buffer.byteLength);
          newBuffer.set(acc, 0);
          newBuffer.set(new Uint8Array(buffer), acc.length);
          return newBuffer;
        }, new Uint8Array()));

        const blob = new Blob([combinedArrayBuffer], { type: 'application/octet-stream' });
        const url = URL.createObjectURL(blob);
        setFileUrl(url);

        return () => {
          URL.revokeObjectURL(url);
        };
      } else {
        throw new Error('Error downloading file');
      }
    } catch (err) {
      setError('Error downloading file. Please try again.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Container maxWidth="sm">
        <Box sx={{ mt: 4, mb: 4, textAlign: 'center' }}>
          <Typography variant="h4" component="h1" gutterBottom>
            File Upload and Download
          </Typography>
          <form onSubmit={handleSubmit} style={{ marginBottom: '20px' }}>
            <input type="file" id='file' name='file' placeholder='Select file' required style={{ marginBottom: '20px', display: 'block' }} />
            <Button type="submit" variant="contained" color="primary" disabled={loading}>
              Load
            </Button>
          </form>
          <form onSubmit={handleDownload} style={{ marginBottom: '20px' }}>
            <TextField
              name="id"
              variant="outlined"
              fullWidth
              required
              margin="normal"
              placeholder="Enter File ID"
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      aria-label="search"
                      type="submit"
                      edge="end"
                      disabled={loading}
                      sx={{
                        color: '#aaa', // Color del icono
                        backgroundColor: 'transparent', // Fondo transparente
                        '&:hover': {
                          backgroundColor: 'transparent', // Sin cambio de fondo al pasar el ratón
                        },
                        '&:active': {
                          backgroundColor: 'transparent', // Sin cambio de fondo al hacer clic
                        },
                      }}
                    >
                      <SearchIcon />
                    </IconButton>
                  </InputAdornment>
                ),
                style: {
                  borderRadius: '30px', // Bordes completamente redondeados
                  padding: '5px 0px 5px 14px;',
                  margin: '0px',
                },
              }}
              style={{ marginTop: '0px', marginBottom: '0px' }} // Reducir margen vertical
            />
            {/* <Button type="submit" variant="contained" color="secondary" disabled={loading}>
              Download
            </Button> */}
          </form>
          {loading && (
            <Box sx={{ display: 'flex', justifyContent: 'center', marginBottom: '20px' }}>
              <CircularProgress />
            </Box>
          )}
          {error && (
            <Typography variant="body2" color="error" gutterBottom>
              {error}
            </Typography>
          )}
          {fileUrl && (
            <>
              
              <video controls autoPlay src={fileUrl} style={{ display: 'block', maxWidth: '100%', marginTop: '20px' }} />
              <Button href={fileUrl} download="downloadedFile" variant="contained" color="primary" style={{ marginTop: '20px' }}>
                Download File
              </Button>
            </>
          )}
        </Box>
      </Container>
    </ThemeProvider>
  );
}

export default App;
