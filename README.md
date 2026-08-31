# Seguimiento Académico SENA

Sistema integral de seguimiento y análisis académico para fichas SENA y Formación Complementaria (PE-04), con sincronización automática desde Google Drive, métricas en tiempo real, alertas de inasistencias y exportación de reportes PDF.

---

## 🚀 Despliegue en Vercel y GitHub

### Opción 1: Despliegue automático con Vercel y GitHub

1. **Subir a GitHub**:
   ```bash
   git init
   git add .
   git commit -m "Initial commit - Seguimiento Academico SENA"
   git branch -M main
   git remote add origin https://github.com/TU_USUARIO/TU_REPOSITORIO.git
   git push -u origin main
   ```

2. **Conectar con Vercel**:
   - Entra en [Vercel](https://vercel.com) e inicia sesión con tu cuenta de GitHub.
   - Haz clic en **"Add New Project"** e importa el repositorio de GitHub.
   - Framework Preset: **Vite** (detectado automáticamente).
   - Root Directory: `./`
   - Build Command: `npm run build`
   - Output Directory: `dist`
   - Haz clic en **Deploy**.

---

## 💻 Ejecución Local

### Requisitos previos:
- [Node.js](https://nodejs.org/) v18 o superior.
- [npm](https://www.npmjs.com/) v9 o superior.

### Pasos:
1. **Instalar dependencias**:
   ```bash
   npm install
   ```

2. **Iniciar en modo desarrollo**:
   ```bash
   npm run dev
   ```
   Abre tu navegador en `http://localhost:3000`.

3. **Compilar para producción**:
   ```bash
   npm run build
   ```

4. **Probar la compilación**:
   ```bash
   npm run preview
   ```

---

## 📁 Estructura del Proyecto

- `/src/components/`: Vistas de análisis académico (PE-04, DF14, Inasistencias, Instructores, etc.).
- `/src/services/`: Servicios de sincronización de Google Drive y generación de PDFs (jsPDF + autotable).
- `/src/data/`: Datos y esquemas iniciales.
- `/api/`: Funciones Serverless de Vercel para sincronización en vivo con Google Drive sin problemas de CORS.
- `vercel.json`: Configuración de enrutamiento y compilación para Vercel.
