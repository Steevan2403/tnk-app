export function ImageThumb({ name, src }: { name: string; src: string }) {
  return (
    <a href={src} target="_blank" rel="noreferrer" className="block overflow-hidden rounded-md">
      {/* The file route checks the signed-in user, which the image optimizer does not. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={name} loading="lazy" className="aspect-square w-full object-cover" />
    </a>
  );
}
