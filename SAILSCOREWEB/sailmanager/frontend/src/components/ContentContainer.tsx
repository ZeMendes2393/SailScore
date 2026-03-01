export default function ContentContainer({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`max-w-screen-2xl mx-auto px-2 lg:px-3 ${className}`}>
      {children}
    </div>
  );
}
