export default function Logo({
  variant = 'green',
  className,
}: {
  variant?: 'green' | 'white';
  className?: string;
}) {
  const src = variant === 'white' ? '/tdcp-logo-white.png' : '/tdcp-logo-green.png';
  return (
    <img
      src={src}
      alt="Tourism Development Corporation of Punjab"
      className={className}
    />
  );
}
