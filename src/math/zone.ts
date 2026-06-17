import { Vector2D } from "./vector";

export class Zone {
    private position: Vector2D;
    private radius: number;

    constructor(in_position: Vector2D, in_radius: number) {
        this.position = in_position.clone();
        this.radius = in_radius;
    }

    set_position(in_position: Vector2D) {
        this.position = in_position.clone();
    }

    set_radius(in_radius: number) {
        this.radius = in_radius;
    }

    get_position(): Vector2D {
        return this.position;
    }

    get_radius(): number {
        return this.radius;
    }

    clone(): Zone {
        return new Zone(this.position, this.radius);
    }
}