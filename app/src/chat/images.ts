import type { ChatImage } from './types';

// Images in a message (LA-PLT-UC22-R05): pasted into the message box, or the stage as it is drawn. They are held as base64
// with a preview until the message goes; the shell checks what it is sent (desktop/src/chat.ts parseImages).

export const MAX_IMAGES = 6;
/** The most base64 characters one image may be (the shell's limit). */
export const MAX_IMAGE_CHARS = 7_000_000;

const TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp'] as const;
export const isImageType = (type: string): type is ChatImage['mediaType'] => (TYPES as readonly string[]).includes(type);

/** An image waiting to go: what is sent, and a data URL to show it by. */
export interface Attachment extends ChatImage { id: string; preview: string }

let counter = 0;
export const attachmentOf = (image: ChatImage): Attachment => ({ ...image, id: `image-${++counter}`, preview: `data:${image.mediaType};base64,${image.data}` });

/** Reads a pasted or dropped file as an image, or says why it cannot be sent. */
export async function readImage(file: File): Promise<{ image: ChatImage } | { problem: string }> {
  if (!isImageType(file.type)) return { problem: `${file.type || 'That file'} is not an image Claude can read (PNG, JPEG, GIF or WebP).` };
  const data = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).replace(/^data:[^,]*,/, ''));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
  if (data.length > MAX_IMAGE_CHARS) return { problem: 'That image is larger than 5 MB.' };
  return { image: { mediaType: file.type, data } };
}

/** The image files on a paste. */
export const imagesOnPaste = (data: DataTransfer | null): File[] => [...(data?.files ?? [])].filter((f) => f.type.startsWith('image/'));
