import { describe, it, expect } from 'vitest';
import { formatRoleTitle, formatUserName } from './roleUtils';

describe('roleUtils', () => {
  describe('formatRoleTitle', () => {
    it('translates Vietnamese roles to English when lang is en', () => {
      expect(formatRoleTitle('Quản trị viên', 'en')).toBe('Administrator');
      expect(formatRoleTitle('Quản trị hệ thống', 'en')).toBe('System Administrator');
      expect(formatRoleTitle('Chuyên viên', 'en')).toBe('Specialist');
      expect(formatRoleTitle('Trưởng phòng', 'en')).toBe('Department Head');
      expect(formatRoleTitle('Văn thư', 'en')).toBe('Archivist / Document Clerk');
    });

    it('keeps Vietnamese roles when lang is vi', () => {
      expect(formatRoleTitle('Quản trị viên', 'vi')).toBe('Quản trị viên');
      expect(formatRoleTitle('admin', 'vi')).toBe('Quản trị viên');
      expect(formatRoleTitle('Chuyên viên', 'vi')).toBe('Chuyên viên');
    });

    it('returns empty string if role is undefined or empty', () => {
      expect(formatRoleTitle(undefined, 'en')).toBe('');
      expect(formatRoleTitle('', 'en')).toBe('');
    });
  });

  describe('formatUserName', () => {
    it('formats admin user name to English when lang is en', () => {
      expect(formatUserName('Quản trị hệ thống', 'en')).toBe('System Administrator');
      expect(formatUserName('admin', 'en')).toBe('System Administrator');
    });

    it('preserves other user names', () => {
      expect(formatUserName('Nguyễn Văn A', 'en')).toBe('Nguyễn Văn A');
      expect(formatUserName('Châu Tuấn Kiệt', 'en')).toBe('Châu Tuấn Kiệt');
    });
  });
});
