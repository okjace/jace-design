export default function Avatar({ user, size = 32 }) {
  const name = user?.name || user?.username || '?';
  if (user?.picture) {
    return <img className="avatar" src={user.picture} alt="" width={size} height={size} style={{ width: size, height: size }} />;
  }
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) % 360;
  return (
    <span className="avatar avatar-letter" style={{ width: size, height: size, fontSize: size * 0.45, background: `hsl(${h} 70% 50%)` }}>
      {name[0].toUpperCase()}
    </span>
  );
}
