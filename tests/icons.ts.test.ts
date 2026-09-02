import { describe, it, expect } from 'bun:test';
import { getSubjectBySlug, TaalSlugEnum } from '~/components/Icons';

describe('getSubjectBySlug', () => {
    it('should return the correct subject for a given slug', () => {
        const result = getSubjectBySlug(TaalSlugEnum.NL);
        expect(result).toBeDefined();
        expect(result?.slug).toBe(TaalSlugEnum.NL);
    });

    it('should return the correct subject for a string slug', () => {
        const result = getSubjectBySlug('nl');
        expect(result).toBeDefined();
        expect(result?.slug).toBe(TaalSlugEnum.NL);
    });

    it('should return undefined for an invalid slug', () => {
        const result = getSubjectBySlug("invalid" as TaalSlugEnum);
        expect(result).toBeUndefined();
    });

    it('should return the correct subject for UPPERCASE slug', () => {
        const result = getSubjectBySlug('NL');
        expect(result).toBeDefined();
        expect(result?.slug).toBe(TaalSlugEnum.NL);
    });
});
