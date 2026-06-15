export function angleBetweenPoints(a, b, c) {
  const ab = { x: a.x - b.x, y: a.y - b.y }
  const cb = { x: c.x - b.x, y: c.y - b.y }
  const dot = ab.x * cb.x + ab.y * cb.y
  const magAB = Math.sqrt(ab.x ** 2 + ab.y ** 2)
  const magCB = Math.sqrt(cb.x ** 2 + cb.y ** 2)
  if (magAB === 0 || magCB === 0) return 0
  const cosAngle = Math.max(-1, Math.min(1, dot / (magAB * magCB)))
  return (Math.acos(cosAngle) * 180) / Math.PI
}

export function avgY(points) {
  return points.reduce((sum, p) => sum + p.y, 0) / points.length
}

export function avgX(points) {
  return points.reduce((sum, p) => sum + p.x, 0) / points.length
}
