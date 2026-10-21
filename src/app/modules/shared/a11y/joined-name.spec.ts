import { aroundLabel, LABEL_SLOT, labelMarkedMarkup } from './joined-name';

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

describe('labelMarkedMarkup', () => {
  it('marks the label with its language and leaves the words around it to the region', () => {
    expect(labelMarkedMarkup(`${LABEL_SLOT}: 2. példány hozzáadva, összesen 4`, 'auteur', 'fr')).toBe(
      '<span lang="fr">auteur</span>: 2. példány hozzáadva, összesen 4',
    );
  });

  it('writes the label and the words as text, whatever they hold', () => {
    expect(labelMarkedMarkup(`<b>${LABEL_SLOT}</b> & more`, 'a <i>"label"</i> & co', 'de-CH')).toBe(
      '&lt;b&gt;<span lang="de-CH">a &lt;i&gt;&quot;label&quot;&lt;/i&gt; &amp; co</span>&lt;/b&gt; &amp; more',
    );
  });

  it('marks nothing where the translation leaves the label out', () => {
    expect(labelMarkedMarkup('Multi.InstanceAdded', 'auteur', 'fr')).toBe('Multi.InstanceAdded');
  });
});
