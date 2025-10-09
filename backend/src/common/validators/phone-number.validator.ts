import {
  registerDecorator,
  ValidationOptions,
  ValidationArguments,
} from 'class-validator';

/**
 * Custom validator for WhatsApp phone numbers (without + prefix)
 * Validates that the phone number:
 * - Contains only digits
 * - Is between 10-15 digits (E.164 standard)
 * - Doesn't start with 0 (must start with country code)
 */
export function IsWhatsAppPhoneNumber(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isWhatsAppPhoneNumber',
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      validator: {
        validate(value: any, args: ValidationArguments) {
          if (typeof value !== 'string') {
            return false;
          }

          // Must be only digits
          if (!/^\d+$/.test(value)) {
            return false;
          }

          // Must be 10-15 digits (E.164 standard)
          if (value.length < 10 || value.length > 15) {
            return false;
          }

          // Must not start with 0 (should have country code)
          if (value.startsWith('0')) {
            return false;
          }

          return true;
        },
        defaultMessage(args: ValidationArguments) {
          return `${args.property} must be a valid phone number (10-15 digits, no + sign, cannot start with 0)`;
        },
      },
    });
  };
}

/**
 * Common validation patterns for phone numbers
 */
export const PHONE_NUMBER_PATTERNS = {
  /**
   * E.164 format without + (e.g., 2348123189656)
   * - 10-15 digits
   * - Cannot start with 0
   */
  WHATSAPP_ID: /^[1-9]\d{9,14}$/,

  /**
   * E.164 format with + (e.g., +2348123189656)
   */
  E164_WITH_PLUS: /^\+[1-9]\d{9,14}$/,

  /**
   * Nigerian phone numbers (with country code, no +)
   * Examples: 2348012345678, 2349012345678
   */
  NIGERIAN: /^234[789]\d{9}$/,

  /**
   * US phone numbers (with country code, no +)
   * Example: 12025551234
   */
  US: /^1[2-9]\d{9}$/,
};

/**
 * Validates Nigerian phone numbers specifically
 */
export function IsNigerianPhoneNumber(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isNigerianPhoneNumber',
      target: object.constructor,
      propertyName: propertyName,
      options: validationOptions,
      validator: {
        validate(value: any) {
          if (typeof value !== 'string') return false;
          return PHONE_NUMBER_PATTERNS.NIGERIAN.test(value);
        },
        defaultMessage(args: ValidationArguments) {
          return `${args.property} must be a valid Nigerian phone number (234XXXXXXXXXX)`;
        },
      },
    });
  };
}
