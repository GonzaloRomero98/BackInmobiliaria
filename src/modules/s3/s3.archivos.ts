import { IsUrl } from "class-validator";

const MB = 1024 * 1024;

// Para los DTOs con URLs de archivos: solo https (nada de javascript:, data: ni http:).
// Que además sea de este bucket y de su carpeta lo revisa S3Service.exigirArchivo en el servicio.
export const UrlHttps = () => IsUrl({protocols:['https'], require_protocol:true}, {message:'$property debe ser una URL https'});

const IMAGENES: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
};

const MODELOS_3D: Record<string, string> = {
    'model/gltf-binary': 'glb',
    'model/gltf+json': 'gltf',
};

export const REGLAS_CARPETA = {
    proyectos: {tipos: IMAGENES, maxBytes: 10 * MB},
    modelosImagenes: {tipos: IMAGENES, maxBytes: 10 * MB},
    modelos3D: {tipos: MODELOS_3D, maxBytes: 100 * MB},
    perfiles: {tipos: IMAGENES, maxBytes: 2 * MB},
} as const;

export type CarpetaS3 = keyof typeof REGLAS_CARPETA;
export const CARPETAS = Object.keys(REGLAS_CARPETA) as CarpetaS3[];
