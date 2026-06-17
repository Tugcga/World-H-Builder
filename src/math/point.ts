import { Vector2D } from "./vector";

export class Point {
    private position: Vector2D;

    // angle is the direction angle from positive Ox in counter-clockwise direction
    private angle: number;

    constructor(in_position: Vector2D, in_angle: number) {
        this.position = in_position.clone();
        this.angle = in_angle;
    }

    set_position(in_position: Vector2D) {
        this.position = in_position.clone();
    }

    set_angle(in_angle: number) {
        this.angle = in_angle;
    }

    get_position(): Vector2D {
        return this.position;
    }

    get_angle(): number {
        return this.angle;
    }

    clone(): Point {
        return new Point(this.position, this.angle);
    }
}