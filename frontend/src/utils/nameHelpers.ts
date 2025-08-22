import { User } from '../types';

/**
 * Gets the display name for a user (first name only)
 * @param user - The user object
 * @returns The first name for display
 */
export const getDisplayName = (user: User): string => {
  return user.first_name;
};

/**
 * Gets the full name for a user (first + last name)
 * @param user - The user object
 * @returns The full name as a string
 */
export const getFullName = (user: User): string => {
  return `${user.first_name} ${user.last_name || ''}`.trim();
};

/**
 * Gets the initials for a user (first letter of first name)
 * @param user - The user object
 * @returns The first initial in uppercase
 */
export const getInitials = (user: User): string => {
  return user.first_name.charAt(0).toUpperCase();
};

/**
 * Generates a username from email address
 * @param email - The email address
 * @returns A username derived from the email
 */
export const generateUsernameFromEmail = (email: string): string => {
  const localPart = email.split('@')[0];
  // Remove special characters and make lowercase
  return localPart.toLowerCase().replace(/[^a-z0-9]/g, '');
};

/**
 * Generates a username from first and last name with random suffix
 * @param firstName - The first name
 * @param lastName - The last name (optional)
 * @returns A username derived from the names
 */
export const generateUsernameFromName = (firstName: string, lastName?: string): string => {
  const cleanFirst = firstName.toLowerCase().replace(/[^a-z]/g, '');
  const cleanLast = lastName ? lastName.toLowerCase().replace(/[^a-z]/g, '') : '';
  const randomSuffix = Math.floor(Math.random() * 9999).toString().padStart(4, '0');
  
  return `${cleanFirst}${cleanLast}${randomSuffix}`;
};