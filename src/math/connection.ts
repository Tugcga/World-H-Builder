import { is_point_inside_edge } from "./path_utilities";
import { vector2_dot, vector2_distance, vector2_normalise, vector2_subtract, Vector2D } from "./vector";

export class Connection {
    private start: Vector2D;
    private end: Vector2D;
    private center: Vector2D;
    private normal: Vector2D;  // normalised vector directed out from the room
    private direction: Vector2D;
    private size: number;

    constructor(in_start: Vector2D, in_end: Vector2D) {
        this.start = in_start.clone();
        this.end = in_end.clone();
        this.size = vector2_distance(this.start, this.end);
        this.center = new Vector2D((in_start.get_x() + in_end.get_x()) / 2.0,
                                   (in_start.get_y() + in_end.get_y()) / 2.0);
        this.direction = vector2_normalise(vector2_subtract(in_end, in_start));
        this.normal = new Vector2D(this.direction.get_y(), -1.0 * this.direction.get_x());
    }

    get_start(): Vector2D {
        return this.start;
    }

    get_end(): Vector2D {
        return this.end;
    }

    get_center(): Vector2D {
        return this.center;
    }

    get_direction(): Vector2D {
        return this.direction;
    }

    get_normal(): Vector2D {
        return this.normal;
    }

    get_size(): number {
        return this.size;
    }

    is_point_inside(point: Vector2D): boolean {
        // return true if input point is inside the connection edge
        return is_point_inside_edge(this.start, this.end, point, true);
    }

    is_in_neighbourhood(point: Vector2D, epsilon: number = 0.5): boolean {
        // return true if the input point in the neighbourhood of the connection edge
        const to_point = vector2_subtract(point, this.start);
        const v = vector2_dot(this.direction, to_point);
        if (v < 0.0) {
            // point project before the start
            if (vector2_distance(this.start, point) < epsilon) {
                return true;
            }
            return false;
        } else {
            if (v > this.size) {
                // point project after the end
                if (vector2_distance(this.end, point) < epsilon) {
                    return true;
                }
                return false;
            } else {
                // point project between start and end
                // calculate distance from point to an edge
                const d = Math.sqrt(to_point.length_square() - v * v);
                if (d < epsilon) {
                    return true;
                }
                return false;
            }
        }

        return false;
    }

    is_overlap(a: Vector2D, b: Vector2D): boolean {
        // return true if this connection overlaps with the edge [a, b]
        if (is_point_inside_edge(this.start, this.end, a, true) ||
            is_point_inside_edge(this.start, this.end, b, true) ||
            is_point_inside_edge(a, b, this.start, true) ||
            is_point_inside_edge(a, b, this.end, true)) {
            return true;
        }

        return false;
    }

    clone(): Connection {
        return new Connection(this.start, this.end);
    }
}