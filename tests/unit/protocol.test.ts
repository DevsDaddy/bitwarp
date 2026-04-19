/**
 * BitWarp Networking protocol tests
 *
 * @author                Elijah Rastorguev
 * @version               1.0.0
 * @build                 1002
 * @git                   https://github.com/devsdaddy/bitwarp
 * @license               MIT
 * @updated               18.04.2026
 */
/* Import required modules */
import { describe, expect } from 'vitest';
import {
  ErrorHandler,
  ErrorPacket,
  ErrorPayload,
  ErrorType, HandshakePacket,
  HandshakePayload,
  HandshakeStep,
  PROTOCOL_VERSION
} from '../../src/shared';

/**
 * Describe tests
 */
describe('BitWrap Protocol Tests', () => {
  // Simple packets tests
  describe('Packets Tests', () => {
    it('Error packet test', () => {
      let error = new ErrorHandler(`This is a test error`, null, ErrorType.ClientException);
      let errorPayload : ErrorPayload = {
        message: error.message,
        stack: error.stack ?? "",
        code: error.type
      };
      let packed = ErrorPacket.encode(errorPayload);
      let unpacked = ErrorPacket.decode(packed);
      let converted = ErrorHandler.fromBuffer(packed);

      expect(error).toEqual(converted);
      expect(errorPayload).toEqual(unpacked.payload);
    });
    it('Handshake packet test', () => {
      let handshakePayload : HandshakePayload = {
        step: HandshakeStep.INIT,
        protocolVersion: PROTOCOL_VERSION,
        clientPublicKey: new Uint8Array(32)
      };
      let packed = HandshakePacket.encode(handshakePayload);
      let unpacked = HandshakePacket.decode(packed);

      expect(handshakePayload).toEqual(unpacked.payload);
    });
  })
});