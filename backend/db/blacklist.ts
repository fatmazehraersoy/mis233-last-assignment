
class SimpleBloomFilter {
    private size: number;
    private storage: Int32Array;

    constructor(size: number = 1000) {
        this.size = size;
        this.storage = new Int32Array(Math.ceil(size / 32));
    }

 
    private hash(str: string, seed: number): number {
        let h = 0x811c9dc5;
        for (let i = 0; i < str.length; i++) {
            h ^= str.charCodeAt(i) ^ seed;
            h = Math.imul(h, 0x01000193);
        }
        return (h >>> 0) % this.size;
    }


    add(item: string): void {
        
        const h1 = this.hash(item, 123);
        const h2 = this.hash(item, 456);
        const h3 = this.hash(item, 789);

        this.setBit(h1);
        this.setBit(h2);
        this.setBit(h3);
    }

  
    has(item: string): boolean {
        const h1 = this.hash(item, 123);
        const h2 = this.hash(item, 456);
        const h3 = this.hash(item, 789);

        
        return this.getBit(h1) && this.getBit(h2) && this.getBit(h3);
    }

    private setBit(index: number) {
        const i = Math.floor(index / 32);
        const bit = index % 32;
        this.storage[i] |= (1 << bit);
    }

    private getBit(index: number): boolean {
        const i = Math.floor(index / 32);
        const bit = index % 32;
        return (this.storage[i] & (1 << bit)) !== 0;
    }
}


const bloomService = new SimpleBloomFilter(10000); 

export function addJtiToBlacklist(jti: string) {
    bloomService.add(jti);
    console.log(`[BloomFilter] JTI eklendi: ${jti}`);
}

export function isJtiBlacklisted(jti: string): boolean {
    const exists = bloomService.has(jti);
    if (exists) {
        console.log(`[BloomFilter] JTI yakalandı (Blacklisted): ${jti}`);
    }
    return exists;
}


export function extractJtiFromJwt(token: string): string | null {
    try {
        const parts = token.split('.');
        if (parts.length !== 3) return null;
        const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
        const jsonPayload = atob(base64);
        const payload = JSON.parse(jsonPayload);
        return payload.jti || null;
    } catch (error) {
        return null;
    }
}