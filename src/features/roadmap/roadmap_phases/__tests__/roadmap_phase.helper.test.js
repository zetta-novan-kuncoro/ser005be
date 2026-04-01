'use strict';

// US-131, US-132, US-133, US-134, US-135

jest.mock('../roadmap_phase.model');
jest.mock('../../../evolution_request/evolution_requests/evolution_request.model');

const RoadmapPhaseModel = require('../roadmap_phase.model');
const EvolutionRequestModel = require('../../../evolution_request/evolution_requests/evolution_request.model');

const {
  GetRoadmapPhases,
  GetPublicRoadmap,
  CreateRoadmapPhase,
  UpdateRoadmapPhase,
  ReorderRoadmapPhases,
  DeleteRoadmapPhase,
} = require('../roadmap_phase.helper');

function mockPhase(overrides = {}) {
  return {
    _id: 'phase-mongo-id',
    phase_id: 'uuid-phase-1',
    application_reference: 'test-app',
    phase_name: 'Q1 2025',
    order: 0,
    description: '',
    ...overrides,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('CreateRoadmapPhase (US-131)', () => {
  it('creates a phase with UUID phase_id and returns it', async () => {
    const phase = mockPhase();
    RoadmapPhaseModel.create = jest.fn().mockResolvedValue({ ...phase, toObject: () => phase });

    const result = await CreateRoadmapPhase({
      application_reference: 'test-app',
      phase_name: 'Q1 2025',
      order: 0,
    });

    expect(RoadmapPhaseModel.create).toHaveBeenCalledTimes(1);
    const createArg = RoadmapPhaseModel.create.mock.calls[0][0];
    expect(createArg).toHaveProperty('phase_id');
    expect(result).toBeDefined();
  });

  it('throws VALIDATION_ERROR for missing required fields', async () => {
    await expect(CreateRoadmapPhase({ phase_name: 'Q1', order: 0 })).rejects.toMatchObject({
      extensions: { code: 'VALIDATION_ERROR' },
    });
  });

  it('throws VALIDATION_ERROR for negative order', async () => {
    await expect(
      CreateRoadmapPhase({ application_reference: 'app', phase_name: 'Q1', order: -1 })
    ).rejects.toMatchObject({ extensions: { code: 'VALIDATION_ERROR' } });
  });
});

describe('UpdateRoadmapPhase (US-132)', () => {
  it('applies partial update and returns updated phase', async () => {
    const updated = mockPhase({ phase_name: 'Q2 2025' });
    RoadmapPhaseModel.findOneAndUpdate = jest.fn().mockReturnValue({
      lean: jest.fn().mockResolvedValue(updated),
    });

    const result = await UpdateRoadmapPhase('uuid-phase-1', { phase_name: 'Q2 2025' });
    expect(result.phase_name).toBe('Q2 2025');
  });

  it('throws NOT_FOUND when phase does not exist (US-132)', async () => {
    RoadmapPhaseModel.findOneAndUpdate = jest.fn().mockReturnValue({
      lean: jest.fn().mockResolvedValue(null),
    });

    await expect(UpdateRoadmapPhase('non-existent', { phase_name: 'X' })).rejects.toMatchObject({
      extensions: { code: 'NOT_FOUND' },
    });
  });

  it('throws VALIDATION_ERROR for unknown fields (US-132)', async () => {
    await expect(
      UpdateRoadmapPhase('uuid-phase-1', { application_reference: 'other' })
    ).rejects.toMatchObject({ extensions: { code: 'VALIDATION_ERROR' } });
  });
});

describe('GetRoadmapPhases (US-136)', () => {
  it('returns phases sorted by order', async () => {
    const phases = [mockPhase({ order: 0 }), mockPhase({ order: 1, phase_id: 'uuid-phase-2' })];
    RoadmapPhaseModel.find = jest.fn().mockReturnValue({
      sort: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(phases) }),
    });

    const result = await GetRoadmapPhases('test-app');
    expect(result).toHaveLength(2);
    expect(RoadmapPhaseModel.find).toHaveBeenCalledWith({ application_reference: 'test-app' });
  });
});

describe('GetPublicRoadmap (US-135)', () => {
  it('returns phases for public consumption', async () => {
    const phases = [mockPhase()];
    RoadmapPhaseModel.find = jest.fn().mockReturnValue({
      sort: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(phases) }),
    });

    const result = await GetPublicRoadmap('test-app');
    expect(Array.isArray(result)).toBe(true);
  });
});

describe('ReorderRoadmapPhases (US-133)', () => {
  it('bulk-updates order for given phase IDs', async () => {
    RoadmapPhaseModel.bulkWrite = jest.fn().mockResolvedValue({});
    const phases = [
      mockPhase({ phase_id: 'p1', order: 0 }),
      mockPhase({ phase_id: 'p2', order: 1 }),
    ];
    RoadmapPhaseModel.find = jest.fn().mockReturnValue({
      sort: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(phases) }),
    });

    const result = await ReorderRoadmapPhases('test-app', ['p1', 'p2']);

    expect(RoadmapPhaseModel.bulkWrite).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({ updateOne: expect.objectContaining({ update: { $set: { order: 0 } } }) }),
        expect.objectContaining({ updateOne: expect.objectContaining({ update: { $set: { order: 1 } } }) }),
      ])
    );
    expect(result).toHaveLength(2);
  });
});

describe('DeleteRoadmapPhase (US-134)', () => {
  it('deletes phase and unsets phase_id on linked evolution requests', async () => {
    const phase = mockPhase();
    RoadmapPhaseModel.findOne = jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(phase) });
    EvolutionRequestModel.updateMany = jest.fn().mockResolvedValue({});
    RoadmapPhaseModel.deleteOne = jest.fn().mockResolvedValue({ deletedCount: 1 });

    const result = await DeleteRoadmapPhase('uuid-phase-1');

    expect(EvolutionRequestModel.updateMany).toHaveBeenCalledWith(
      { phase_id: 'uuid-phase-1' },
      { $set: { phase_id: null } }
    );
    expect(RoadmapPhaseModel.deleteOne).toHaveBeenCalledWith({ phase_id: 'uuid-phase-1' });
    expect(result).toBe(true);
  });

  it('throws NOT_FOUND for non-existent phase', async () => {
    RoadmapPhaseModel.findOne = jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(null) });

    await expect(DeleteRoadmapPhase('non-existent')).rejects.toMatchObject({
      extensions: { code: 'NOT_FOUND' },
    });
  });
});
