import { vector2_add, vector2_scale, vector2_subtract, Vector2D } from "./vector";

export class Door {
    // center define the first point of the door line
    // angle define the angle between positive direction of OX and door line
    // in the canvas we should always draw the door as a line between these two points
    // and limited by room walls

    // direction angle changed by Alt-key
    private center_point: Vector2D;
    private angle: number;
    private direction: Vector2D;

    constructor(in_center: Vector2D, in_angle: number) {
        this.center_point = in_center;
        this.angle = in_angle;
        this.direction = this._angle_to_direction(in_angle);
    }

    private _angle_to_direction(angle: number): Vector2D {
        return new Vector2D(Math.cos(angle), -1.0 * Math.sin(angle));
    }

    set_angle(in_angle: number) {
        this.angle = in_angle;
        this.direction = this._angle_to_direction(in_angle);
    }

    get_center(): Vector2D {
        return this.center_point;
    }

    get_direction(): Vector2D {
        return this.direction;
    }

    get_angle(): number {
        return this.angle;
    }

    get_point(t: number): Vector2D {
        return vector2_add(this.center_point, vector2_scale(this.direction, t));
    }

    private _intersect_with_edge(start: Vector2D, end: Vector2D, negate_direction: boolean): number {
        const c = negate_direction ? -1.0 : 1.0;
        const v = vector2_subtract(end, start);
        const denom = c * this.direction.get_x() * v.get_y() - c * this.direction.get_y() * v.get_x();
        if (Math.abs(denom) < 0.001) {
            return Number.MAX_VALUE
        }
        
        const to_start = vector2_subtract(start, this.center_point);
        const t = (to_start.get_x() * v.get_y() - to_start.get_y() * v.get_x()) / denom;
        const u = (to_start.get_x() * c * this.direction.get_y() - to_start.get_y() * c * this.direction.get_x()) / denom;
        if (t >= 0 && u >= 0 && u <= 1) {
            return t;
        }

        return Number.MAX_VALUE;
    }

    private _get_intersection(cycles: Array<Array<Vector2D>>, negate_direction: boolean): number {
        let min_t = Number.MAX_VALUE;
        for (let i = 0; i < cycles.length; i++) {
            const cycle = cycles[i];
            for (let j = 0; j < cycle.length; j++) {
                const start = cycle[j];
                const end = cycle[(j + 1) % cycle.length];

                const t = this._intersect_with_edge(start, end, negate_direction);
                if (t < min_t) {
                    min_t = t;
                }
            }
        }

        return min_t;
    }

    get_positive_intersection(cycles: Array<Array<Vector2D>>): number {
        return this._get_intersection(cycles, false);
    }

    get_negative_intersection(cycles: Array<Array<Vector2D>>): number {
        return this._get_intersection(cycles, true);
    }

    clone(): Door {
        return new Door(this.center_point, this. angle);
    }
}