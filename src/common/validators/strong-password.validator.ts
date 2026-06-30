import { registerDecorator, type ValidationOptions } from 'class-validator';

const STRONG_PASSWORD =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9\s]).{12,128}$/;

export function assertStrongPassword(password: string): void {
  if (!STRONG_PASSWORD.test(password)) {
    throw new Error(
      'Password must be 12–128 characters with uppercase, lowercase, number, and special character',
    );
  }
}

export function isStrongPassword(password: string): boolean {
  return STRONG_PASSWORD.test(password);
}

export function IsStrongPassword(validationOptions?: ValidationOptions) {
  return function register(object: object, propertyName: string) {
    registerDecorator({
      name: 'isStrongPassword',
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown) {
          return typeof value === 'string' && STRONG_PASSWORD.test(value);
        },
        defaultMessage() {
          return 'Password must be 12–128 characters with uppercase, lowercase, number, and special character';
        },
      },
    });
  };
}
