import { Vector2D } from "./vector";

export function is_point_inside_edge(a: Vector2D, b: Vector2D, point: Vector2D, allow_vertex: boolean, e: number = 0.0001): boolean {
    if (a.is_coincide(point) || b.is_coincide(point)) {
        return allow_vertex;
    }

    const ab = new Vector2D(b.get_x() - a.get_x(), b.get_y() - a.get_y());
    const ap = new Vector2D(point.get_x() - a.get_x(), point.get_y() - a.get_y());

    const area = Math.abs(ab.get_x() * ap.get_y() - ab.get_y() * ap.get_x());
    if (area < e) {
        if (Math.min(a.get_x(), b.get_x()) <= point.get_x() &&
            Math.max(a.get_x(), b.get_x()) >= point.get_x() &&
            Math.min(a.get_y(), b.get_y()) <= point.get_y() &&
            Math.max(a.get_y(), b.get_y()) >= point.get_y()) {
            return true;
        }
    }

    return false;
}