'use strict';

// US-131, US-132

const { ValidateCreateRoadmapPhase, ValidateUpdateRoadmapPhase } = require('../roadmap_phase.validator');

describe('ValidateCreateRoadmapPhase (US-131)', () => {
  const VALID = {
    application_reference: 'my-app',
    phase_name: 'Q1 2025',
    order: 0,
  };

  it('accepts valid minimal input', () => {
    const { error } = ValidateCreateRoadmapPhase(VALID);
    expect(error).toBeUndefined();
  });

  it('accepts with optional description', () => {
    const { error } = ValidateCreateRoadmapPhase({ ...VALID, description: 'First quarter' });
    expect(error).toBeUndefined();
  });

  it('requires application_reference', () => {
    const { error } = ValidateCreateRoadmapPhase({ ...VALID, application_reference: undefined });
    expect(error).toBeDefined();
  });

  it('requires phase_name', () => {
    const { error } = ValidateCreateRoadmapPhase({ ...VALID, phase_name: undefined });
    expect(error).toBeDefined();
  });

  it('requires order', () => {
    const { error } = ValidateCreateRoadmapPhase({ ...VALID, order: undefined });
    expect(error).toBeDefined();
  });

  it('rejects negative order', () => {
    const { error } = ValidateCreateRoadmapPhase({ ...VALID, order: -1 });
    expect(error).toBeDefined();
  });

  it('rejects non-integer order', () => {
    const { error } = ValidateCreateRoadmapPhase({ ...VALID, order: 1.5 });
    expect(error).toBeDefined();
  });

  it('accepts order = 0', () => {
    const { error } = ValidateCreateRoadmapPhase({ ...VALID, order: 0 });
    expect(error).toBeUndefined();
  });
});

describe('ValidateUpdateRoadmapPhase (US-132)', () => {
  it('accepts empty object (all optional)', () => {
    const { error } = ValidateUpdateRoadmapPhase({});
    expect(error).toBeUndefined();
  });

  it('accepts partial update with only phase_name', () => {
    const { error } = ValidateUpdateRoadmapPhase({ phase_name: 'Q2 2025' });
    expect(error).toBeUndefined();
  });

  it('accepts partial update with only order', () => {
    const { error } = ValidateUpdateRoadmapPhase({ order: 3 });
    expect(error).toBeUndefined();
  });

  it('rejects negative order in update', () => {
    const { error } = ValidateUpdateRoadmapPhase({ order: -1 });
    expect(error).toBeDefined();
  });

  it('rejects unknown fields (US-132)', () => {
    const { error } = ValidateUpdateRoadmapPhase({ application_reference: 'other' });
    expect(error).toBeDefined();
  });
});
