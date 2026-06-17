
export function vector2_dot(a: Vector2D, b: Vector2D): number {
    return a.get_x() * b.get_x() + a.get_y() * b.get_y();
}

export function vector2_subtract(a: Vector2D, b: Vector2D): Vector2D {
    return new Vector2D(a.get_x() - b.get_x(), a.get_y() - b.get_y());
}

export function vector2_add(a: Vector2D, b: Vector2D): Vector2D {
    return new Vector2D(a.get_x() + b.get_x(), a.get_y() + b.get_y());
}

export function vector2_normalise(a: Vector2D): Vector2D {
    const length = a.length();
    if (length > 0.0001) {
        return new Vector2D(a.get_x() / length, a.get_y() / length);
    }
    return new Vector2D();
}

export function vector2_distance(a: Vector2D, b: Vector2D): number {
    // return distance between points a and b in the plane
    return vector2_subtract(b, a).length();
}

export function vector2_scale(vector: Vector2D, coefficient: number): Vector2D {
    return new Vector2D(vector.get_x() * coefficient, vector.get_y() * coefficient);
}

export function angle_between_vectors(a: Vector2D, b: Vector2D): number {
    // make vectors unit length
    const a_length = a.length();
    const b_length = b.length();

    const a_normalised = new Vector2D(a.get_x() / a_length, a.get_y() / a_length);
    const b_normalised = new Vector2D(b.get_x() / b_length, b.get_y() / b_length);

    //calculate direction
    const a_cross_b = a_normalised.get_x() * b_normalised.get_y() - a_normalised.get_y() * b_normalised.get_x();
    const a_dot_b = a_normalised.get_x() * b_normalised.get_x() + a_normalised.get_y() * b_normalised.get_y();
    
    if (a_cross_b > 0.0) {
        return Math.acos(a_dot_b);
    } else {
        return -Math.acos(a_dot_b);
    }
}

export class Vector2D {
    private x: number = 0.0;
    private y: number = 0.0;

    constructor(in_x: number = 0.0, in_y: number = 0.0) {
        this.x = in_x;
        this.y = in_y;
    }

    get_x(): number {
        return this.x;
    }

    get_y(): number {
        return this.y;
    }

    set_values(in_x: number, in_y: number) {
        this.x = in_x;
        this.y = in_y;
    }

    is_coincide(other: Vector2D, e: number = 0.01) {
        return Math.abs(this.x - other.get_x()) < e && Math.abs(this.y - other.get_y()) < e;
    }

    length_square(): number {
        return this.x * this.x + this.y * this.y;
    }

    length(): number {
        return Math.sqrt(this.x * this.x + this.y * this.y);
    }

    clone(): Vector2D {
        return new Vector2D(this.x, this.y);
    }
}