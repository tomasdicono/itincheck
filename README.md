# itincheck

Herramienta web para analizar itinerarios en Excel (procesamiento en el navegador). React, TypeScript y Vite.

## Desarrollo

```bash
npm install
npm run dev
```

## Producción

```bash
npm run build
```

Salida en la carpeta `dist`.

Comprobación de tipos (opcional, p. ej. en local o CI):

```bash
npm run typecheck
```

## Vercel

1. Creá el repositorio en GitHub (por ejemplo `itincheck`) y subí este código.
2. En [Vercel](https://vercel.com), **Add New Project** → importá el repo.
3. Dejá el preset **Vite** (o **Other**): comando de build `npm run build`, directorio de salida `dist`.
