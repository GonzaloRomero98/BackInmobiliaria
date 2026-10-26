const MB = 1024 * 1024;

const IMAGENES: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
};

const MODELOS_3D: Record<string, string> = {
    'model/gltf-binary': 'glb',
    'model/gltf+json': 'gltf',
};

// Tipos de archivo (content-type -> extensión) y tamaño máximo aceptados por carpeta
export const REGLAS_CARPETA = {
    proyectos: {tipos: IMAGENES, maxBytes: 10 * MB},
    modelosImagenes: {tipos: IMAGENES, maxBytes: 10 * MB},
    modelos3D: {tipos: MODELOS_3D, maxBytes: 100 * MB},
} as const;

export type CarpetaS3 = keyof typeof REGLAS_CARPETA;
export const CARPETAS = Object.keys(REGLAS_CARPETA) as CarpetaS3[];
