# ADR 003: Comprehensive Testing Infrastructure

**Status:** Accepted  
**Date:** 2024-01-15  
**Deciders:** Development Team

## Context

The project had:
- **No tests** - Zero test coverage
- **Manual testing only** - Time-consuming, error-prone
- **Regression risk** - Changes could break existing features
- **Low confidence** - Fear of refactoring

This blocked:
- Safe refactoring
- Confident deployments
- Team velocity
- Code quality improvements

## Decision

We implemented a comprehensive 3-layer testing strategy:

### 1. Unit Tests (Jest)
**Target**: 80%+ coverage  
**Focus**: Pure functions, services, utilities

```typescript
// Example: tests/state/Store.test.ts
describe('Store', () => {
  it('should update state immutably', () => {
    store.setState({ notes: [newNote] });
    expect(store.getState().notes).toHaveLength(1);
  });
});
```

### 2. Integration Tests (Jest + Testing Library)
**Target**: Critical workflows  
**Focus**: Component interactions, service integration

```typescript
// Example: Component + Store integration
it('should save note on text change', async () => {
  render(<NoteComponent />);
  fireEvent.change(textarea, { target: { value: 'Test' } });
  await waitFor(() => {
    expect(mockStorage.save).toHaveBeenCalled();
  });
});
```

### 3. E2E Tests (Playwright)
**Target**: User journeys  
**Focus**: Real browser, full extension loaded

```typescript
// Example: tests/e2e/sidebar.spec.ts
test('should add and edit note', async ({ page }) => {
  await page.goto('youtube.com/watch?v=...');
  await page.click('#addNoteButton');
  await page.fill('.note textarea', 'My note');
  await expect(textarea).toHaveValue('My note');
});
```

## Testing Stack

| Layer | Tool | Purpose |
|-------|------|---------|
| Unit | Jest | Fast, isolated tests |
| Integration | Jest + Testing Library | Component interactions |
| E2E | Playwright | Real browser automation |
| Coverage | Istanbul (via Jest) | Track test coverage |
| Assertions | Jest matchers + @testing-library/jest-dom | Rich assertions |

## Consequences

### Positive
- **Confidence**: Safe to refactor and add features
- **Documentation**: Tests document expected behavior
- **Regression Prevention**: Catch breaks before production
- **Code Quality**: Forces better architecture
- **Onboarding**: New devs understand code via tests
- **CI/CD Ready**: Automated quality gates

### Negative
- **Time Investment**: Writing tests takes time upfront
- **Maintenance**: Tests need updates when code changes
- **Flakiness Risk**: E2E tests can be unstable
- **Learning Curve**: Team needs testing skills

### Neutral
- **Build Time**: +30s for full test suite
- **Dev Dependencies**: +15MB for testing tools

## Coverage Targets

```json
{
  "coverageThreshold": {
    "global": {
      "branches": 80,
      "functions": 80,
      "lines": 80,
      "statements": 80
    }
  }
}
```

### Priority Coverage
1. **Critical Path**: 100% (State management, Storage, Encryption)
2. **Services**: 90% (Theme, Language, Share)
3. **Components**: 70% (UI components)
4. **Utilities**: 80% (Helper functions)

## Test Organization

```
tests/
├── setup.ts              # Global test setup
├── mocks/                # Shared mocks
│   ├── chrome.ts
│   └── storage.ts
├── unit/
│   ├── state/
│   │   └── Store.test.ts
│   └── services/
│       └── EncryptionService.test.ts
├── integration/
│   └── components/
│       └── Sidebar.test.ts
└── e2e/
    ├── sidebar.spec.ts
    └── notes.spec.ts
```

## CI/CD Integration

```yaml
# .github/workflows/test.yml
name: Tests
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - run: npm ci
      - run: npm run lint
      - run: npm run type-check
      - run: npm run test
      - run: npm run e2e
      - uses: codecov/codecov-action@v3
```

## Testing Best Practices

### 1. Arrange-Act-Assert Pattern
```typescript
it('should add note', () => {
  // Arrange
  const initialCount = store.getState().notes.length;
  
  // Act
  actions.addNote(newNote);
  
  // Assert
  expect(store.getState().notes.length).toBe(initialCount + 1);
});
```

### 2. Test Isolation
- Each test is independent
- Clean up after each test
- Use `beforeEach` for setup

### 3. Mock External Dependencies
```typescript
jest.mock('../services/NoteStorage');
```

### 4. Meaningful Test Names
```typescript
// Good
it('should throw error when password is incorrect')

// Bad
it('test decrypt')
```

## Scripts

```json
{
  "scripts": {
    "test": "jest --coverage",
    "test:watch": "jest --watch",
    "test:unit": "jest --testPathPattern=unit",
    "test:integration": "jest --testPathPattern=integration",
    "e2e": "playwright test",
    "e2e:ui": "playwright test --ui",
    "e2e:debug": "playwright test --debug"
  }
}
```

## Migration Path

### Phase 1 (Current) ✅
- [x] Jest configuration
- [x] Playwright configuration
- [x] Test utilities and mocks
- [x] Core unit tests (Store, Encryption)

### Phase 2 (Next) ⏳
- [ ] Service tests (80% coverage)
- [ ] Component tests (70% coverage)
- [ ] Integration tests (critical paths)

### Phase 3 (Future) ⏳
- [ ] E2E tests (user journeys)
- [ ] Visual regression tests
- [ ] Performance tests

## References
- [Jest Documentation](https://jestjs.io/)
- [Playwright Documentation](https://playwright.dev/)
- [Testing Library Best Practices](https://testing-library.com/docs/guiding-principles)
- Original issue: #47