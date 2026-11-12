'use client';
import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { removeAvatar, uploadAvatar } from '@/app/me/avatar-actions';
import { AVATAR_SIZE, avatarSrc } from '@/lib/avatar';
import { Avatar } from './Avatar';

/** Crop to the middle square and scale down, so what's sent is small whatever the camera took. */
async function shrink(file: File): Promise<Blob> {
  const img = await createImageBitmap(file);
  const side = Math.min(img.width, img.height);
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = AVATAR_SIZE;
  canvas.getContext('2d')!.drawImage(img, (img.width - side) / 2, (img.height - side) / 2, side, side, 0, 0, AVATAR_SIZE, AVATAR_SIZE);
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('no image'))), 'image/jpeg', 0.85));
}

/**
 * The optional photo, on the profile screen: the circle as it appears on Me,
 * and the two things to do with it. Skipping it changes nothing; the circle
 * keeps the player's first initial.
 */
export function AvatarPicker({ name, email, updatedAt, note = 'Optional. Only you see it.' }: {
  name?: string | null; email?: string; updatedAt?: string | null;
  /** Under the buttons. A player's photo is theirs alone; a trainer's goes to their players. */
  note?: string;
}) {
  const [at, setAt] = useState(updatedAt ?? null);
  const [err, setErr] = useState('');
  const [busy, start] = useTransition();
  const input = useRef<HTMLInputElement>(null);
  const router = useRouter();

  function pick(file: File | undefined) {
    if (!file) return;
    setErr('');
    start(async () => {
      try {
        const form = new FormData();
        form.set('avatar', new File([await shrink(file)], 'avatar.jpg', { type: 'image/jpeg' }));
        const r = await uploadAvatar(form);
        if (r.ok) { setAt(r.updatedAt); router.refresh(); } else setErr(r.error);
      } catch { setErr('Couldn’t read that photo. Try another.'); }
      if (input.current) input.current.value = '';
    });
  }

  return (
    <div className="mt-6 flex items-center gap-4">
      <Avatar name={name} email={email} src={avatarSrc(at)} className="h-16 w-16 text-[22px]" />
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" disabled={busy} className="btn-ghost btn-sm pressable" onClick={() => input.current?.click()}>
            {busy ? 'Saving…' : at ? 'Change photo' : 'Add a photo'}
          </button>
          {at && !busy && (
            <button type="button" className="px-2 text-[13px] font-semibold text-on-surface-variant underline underline-offset-4"
                    onClick={() => start(async () => {
                      setErr('');
                      const r = await removeAvatar();
                      if (r.ok) { setAt(null); router.refresh(); } else setErr(r.error);
                    })}>
              Remove
            </button>
          )}
        </div>
        <p className="mt-1.5 text-[12.5px] text-on-surface-variant" role={err ? 'alert' : undefined}>
          {err || note}
        </p>
        <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" tabIndex={-1}
               aria-label="Profile photo" onChange={(e) => pick(e.target.files?.[0])} />
      </div>
    </div>
  );
}
