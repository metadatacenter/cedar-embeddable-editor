import { aroundLabel, LABEL_SLOT } from './joined-name';

describe('aroundLabel', () => {
  it("finds CEE's words after a label that leads the name", () => {
    expect(aroundLabel(`${LABEL_SLOT}, dátum kiválasztása`)).toEqual({
      before: '',
      after: ', dátum kiválasztása',
      labelled: true,
    });
  });

  it("finds CEE's words on both sides of a label that a language puts inside the name", () => {
    expect(aroundLabel(`Time for ${LABEL_SLOT} today`)).toEqual({
      before: 'Time for ',
      after: ' today',
      labelled: true,
    });
  });

  it("reads a translation that leaves the label out as CEE's words alone", () => {
    expect(aroundLabel('Generic.TimeFor')).toEqual({ before: 'Generic.TimeFor', after: '', labelled: false });
  });

  it('shows a label the translation repeats only once', () => {
    expect(aroundLabel(`${LABEL_SLOT}: ${LABEL_SLOT}`)).toEqual({ before: '', after: ': ', labelled: true });
  });
});
