/// <reference types="vite/client" />

// Adicione isto no final do arquivo src/vite-env.d.ts

declare module "pdfmake/build/pdfmake" {
  const pdfMake: any;
  export default pdfMake;
}

declare module "pdfmake/build/vfs_fonts" {
  const pdfFonts: any;
  export default pdfFonts;
}
