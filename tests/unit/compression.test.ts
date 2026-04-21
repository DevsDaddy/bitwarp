/**
 * BitWarp Networking compression module tests
 *
 * @author                Elijah Rastorguev
 * @version               1.0.0
 * @build                 1001
 * @git                   https://github.com/devsdaddy/bitwarp
 * @license               MIT
 * @updated               12.04.2026
 */
/* Import required modules */
import { describe, it, expect } from 'vitest';
import { BWeaveCompression, NativeCompression, BinaryConverter } from '../../src/shared';

/**
 * Describe tests
 */
describe('BitWrap Compression Module Tests', () => {
  const longText = `
  Since the beginning of the 21st century, digital technologies have permeated every aspect of human life. We can no longer imagine our existence without smartphones, social media, search engines, and cloud storage. However, behind this rapid progress lie not only obvious benefits but also profound changes in the functioning of our brains. Neuroscientists, psychologists, and sociologists are increasingly sounding the alarm: the digital environment is restructuring cognitive processes, and not always for the better. In this essay, I will examine the main aspects of this influence—from attention and memory to critical thinking and emotional intelligence.
  Let's start with attention—a fundamental cognitive resource. Modern interfaces and apps compete for every second of our focus. Notifications, pop-ups, and endless news feeds foster so-called "clip-based thinking." The brain becomes accustomed to frequently changing stimuli and loses the ability to concentrate on a single task for long periods. Research shows that the average attention span on a screen has dropped from 12 seconds in 2000 to 8 seconds today—less than that of a goldfish. This is a worrying symptom: the ability to deeply immerse oneself in material, analyze complex texts, or solve multi-step problems atrophies without regular training. Multitasking, so touted as a skill for success, has proven to be a myth. The brain cannot effectively process two streams of information simultaneously; it only quickly switches between them, wasting time and increasing the number of errors.
  Memory is the next most important process. People used to memorize dozens of phone numbers, poems, routes, and faces. Today, we've delegated memorization to external devices. Smartphones remember everything: contacts, appointments, passwords, even our thoughts in the form of notes. This creates a "digital amnesia" effect—we stop encoding information into long-term memory because we know it's easily accessible from the cloud. Neuroplasticity works against us: the less we use memory mechanisms, the weaker the neural connections in the hippocampus become. This is especially noticeable among the younger generation: students increasingly can't recall basic facts without searching on Google. On the other hand, technology has opened up access to colossal amounts of data. But volume doesn't equal understanding. Knowing facts without the ability to connect them, evaluate them, and apply them in practice is simply "raw material," not true erudition.
  Critical thinking suffers from information overload and personalization algorithms. We consume hundreds of news stories, posts, videos, and memes daily. In such a flood, it's difficult to separate truth from lies, facts from opinions, and profundity from sensationalism. Social media algorithms create "filter bubbles"—personalized realities where users see only confirmation of their views. This reinforces cognitive biases such as confirmation bias, the Dunning-Kruger effect, and false correlation. People become less likely to confront difficult arguments, and their ability to conduct a fair debate atrophies. Moreover, short and snappy formats (TikTok, Reels, Shorts) train the brain to experience quick dopamine surges through novelty and surprise. As a result, reading long articles or books feels boring and difficult—the brain simply doesn't receive the usual level of stimulation.
  Emotional intelligence and empathy are also being transformed by the digital environment. On the one hand, we can connect with people all over the world, express sympathy in comments, and participate in charity campaigns online. On the other hand, impersonal correspondence deprives us of nonverbal cues: intonation, facial expressions, and eye contact. We become less sensitive to the pain of others because we don't see tears or hear voices. A phenomenon of "online disinhibition" is emerging: online, people indulge in cruelty and aggression they would never exhibit in real life. Furthermore, spending time on social media replaces face-to-face communication, which is especially dangerous for children and adolescents. Their brains are just learning to recognize emotions and build trusting relationships; without real-world practice, these skills remain underdeveloped.
  However, not everything is so gloomy. Digital technologies, when used correctly, can become trainers for cognitive abilities. There are apps for developing memory, attention, and logic (for example, Dual N-Back, Lumosity). Online courses and educational platforms make knowledge accessible to everyone. Digital tools help structure information (Mind Maps, notes in Obsidian), which facilitates learning. Moreover, the internet provides an opportunity for self-education and the exchange of experiences with like-minded people. The key issue is not the technologies themselves, but the culture of their use. To use the analogy with books: the printing press didn't automatically make everyone smarter—everything depended on what people read and how they interpreted it.
  So how can we maintain brain health in the digital age? First, practice digital hygiene: limit your time on social media, turn off unnecessary notifications, and practice "digital detoxes"—periods of complete disconnection. Second, train your deep attention: set aside time to read complex books, solve problems without distractions, and meditate. Third, use external memory consciously: remember what's truly important (names of loved ones, key dates, routes), rather than relying on gadgets for everything. Fourth, maintain real-life communication: meet up with friends regularly, talk on the phone, and don't just text. Fifth, develop critical thinking: check sources, seek out alternative points of view, and ask yourself, "How do I know this?"
  In summary, digital technology is a powerful tool that simultaneously expands our capabilities and creates new vulnerabilities. Our brain is plastic; it adapts to its environment. If the environment requires rapid switching and superficial scrolling, the brain becomes fast but shallow. However, if we consciously create an environment that allows for focus, reflection, and real interaction, the brain preserves and develops higher cognitive functions. Technology cannot be stopped, but we can learn to manage it rather than allow ourselves to be managed. The future of human intelligence depends not on processors and algorithms, but on our daily habits and conscious choices.
  `

  /* BWeave Compression */
  describe('BWeave Compression Provider Checks', () => {
    // Create compressor
    const compressor = new BWeaveCompression();

    // Empty data test
    it('Roundtrip for empty data', () => {
      const empty = new Uint8Array(0);
      const compressed = compressor.compress(empty);
      const decompressed = compressor.decompress(compressed);
      expect(decompressed).toEqual(empty);
      expect(compressed.length).toBe(4);
    });

    // Short data test
    it('Roundtrip for very short data (size may increase)', () => {
      let start = performance.now();
      const short = BinaryConverter.toUint8Array("Hello");
      const compressed = compressor.compress(short);
      const decompressed = compressor.decompress(compressed);
      let end = performance.now();
      console.log(`BWeave short compression: ${short.byteLength} / ${compressed.byteLength} (${end - start})`);
      expect(decompressed).toEqual(short);
    });

    // Long data test
    it('Compresses long repetitive text effectively', () => {
      let start = performance.now();
      const original = BinaryConverter.toUint8Array("abc".repeat(1000));
      const compressed = compressor.compress(original);
      let end = performance.now();
      console.log(`BWeave long repetitive text: ${original.byteLength} / ${compressed.byteLength} (${end - start})`);
      expect(compressed.length).toBeLessThan(original.length);
      expect(compressor.decompress(compressed)).toEqual(original);
    });

    // Long data test
    it('Compresses long text effectively', () => {
      let start = performance.now();
      const original = BinaryConverter.toUint8Array(longText);
      const compressed = compressor.compress(original);
      let end = performance.now();
      console.log(`BWeave long text: ${original.byteLength} / ${compressed.byteLength} (${end - start})`);
      expect(compressed.length).toBeLessThan(original.length);
      expect(compressor.decompress(compressed)).toEqual(original);
    });

    // Repeating bytes test
    it('Compresses repeating bytes (RLE)', () => {
      let start = performance.now();
      const original = new Uint8Array(5000).fill(0x42);
      const compressed = compressor.compress(original);
      let end = performance.now();
      console.log(`BWeave repetitive bytes: ${original.byteLength} / ${compressed.byteLength} (${end - start})`);
      expect(compressed.length).toBeLessThan(original.length);
      expect(compressor.decompress(compressed)).toEqual(original);
    });
  })

  /* Native Compression */
  describe('Native Compression Provider Checks', () => {
    // Create compressor
    const compressor = new NativeCompression();

    // Empty data test
    it('Roundtrip for empty data', () => {
      const empty = new Uint8Array(0);
      const compressed = compressor.compress(empty);
      const decompressed = compressor.decompress(compressed);
      expect(decompressed).toEqual(empty);
      expect(compressed.length).toBe(0);
    });

    // Short data test
    it('Roundtrip for very short data (size may increase)', () => {
      let start = performance.now();
      const short = BinaryConverter.toUint8Array("Hello");
      const compressed = compressor.compress(short);
      const decompressed = compressor.decompress(compressed);
      let end = performance.now();
      console.log(`Native short compression: ${short.byteLength} / ${compressed.byteLength} (${end - start})`);
      expect(decompressed).toEqual(short);
    });

    // Long data test
    it('Compresses long repetitive text effectively', () => {
      let start = performance.now();
      const original = BinaryConverter.toUint8Array("abc".repeat(1000));
      const compressed = compressor.compress(original);
      let end = performance.now();
      console.log(`Native long repetitive text: ${original.byteLength} / ${compressed.byteLength} (${end - start})`);
      expect(compressed.length).toBeLessThan(original.length);
      expect(compressor.decompress(compressed)).toEqual(original);
    });

    // Long data test
    it('Compresses long text effectively', () => {
      let start = performance.now();
      const original = BinaryConverter.toUint8Array(longText);
      const compressed = compressor.compress(original);
      let end = performance.now();
      console.log(`Native long text: ${original.byteLength} / ${compressed.byteLength} (${end - start})`);
      expect(compressed.length).toBeLessThan(original.length);
      expect(compressor.decompress(compressed)).toEqual(original);
    });

    // Repeating bytes test
    it('Compresses repeating bytes (RLE)', () => {
      let start = performance.now();
      const original = new Uint8Array(5000).fill(0x42);
      const compressed = compressor.compress(original);
      let end = performance.now();
      console.log(`Native repetitive bytes: ${original.byteLength} / ${compressed.byteLength} (${end - start})`);
      expect(compressed.length).toBeLessThan(original.length);
      expect(compressor.decompress(compressed)).toEqual(original);
    });
  })
});