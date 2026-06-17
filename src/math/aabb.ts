import { Vector2D } from "./vector";

export class AABB {
    private min_x: number = 0.0;
    private max_x: number = 0.0;
    private min_y: number = 0.0;
    private max_y: number = 0.0;

    constructor(corner_a: Vector2D = new Vector2D(), corner_b: Vector2D = new Vector2D()) {
        this.min_x = Math.min(corner_a.get_x(), corner_b.get_x());
        this.max_x = Math.max(corner_a.get_x(), corner_b.get_x());

        this.min_y = Math.min(corner_a.get_y(), corner_b.get_y());
        this.max_y = Math.max(corner_a.get_y(), corner_b.get_y());
    }

    extend_by_position(position: Vector2D) {
        this.min_x = Math.min(this.min_x, position.get_x());
        this.max_x = Math.max(this.max_x, position.get_x());

        this.min_y = Math.min(this.min_y, position.get_y());
        this.max_y = Math.max(this.max_y, position.get_y());
    }

    extend_by_padding(padding: number) {
        this.min_x -= padding;
        this.min_y -= padding;

        this.max_x += padding;
        this.max_y += padding;
    }

    get_width(): number {
        return this.max_x - this.min_x;
    }

    get_height(): number {
        return this.max_y - this.min_y;
    }

    get_min_x(): number { return this.min_x; }
    get_max_x(): number { return this.max_x; }
    get_min_y(): number { return this.min_y; }
    get_max_y(): number { return this.max_y; }

    is_contain(point: Vector2D) {
        return point.get_x() >= this.min_x && point.get_x() <= this.max_x && point.get_y() >= this.min_y && point.get_y() <= this.max_y;
    }
}