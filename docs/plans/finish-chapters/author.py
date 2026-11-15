"""Writes the chapter 2 and 3 drafts in this folder (spines, carry and canon drafts, and the beat-by-beat scripts the story file quotes). Run from the repo root: python3 docs/plans/finish-chapters/author.py docs/plans/finish-chapters. Retired once episode-2.json and episode-3.json live in client/public/show/.
script of every beat, so the story doc, the timing runs and the line ledger all read one source."""
import json, sys, os

OUT = sys.argv[1]

def A(**k): return k
def N(text, mood='neutral', w=False): return A(do='narrate', withPrev=w, text=text, mood=mood)
def S(who, text, mood='neutral', to=None, w=False): return A(do='speak', withPrev=w, who=who, text=text, mood=mood, to=to)
def E(who, acting, target=None, w=False): return A(do='emote', withPrev=w, who=who, acting=acting, target=target)
def M(who, to, w=False): return A(do='move', withPrev=w, who=who, to=to)
def P(what, at, w=False): return A(do='place', withPrev=w, what=what, at=at)
def C(cue, target=None, w=False): return A(do='cue', withPrev=w, cue=cue, target=target)
def L(mood, s, w=False): return A(do='light', withPrev=w, mood=mood, seconds=s)
def W(s, w=False): return A(do='wait', withPrev=w, seconds=s)
def R(effect, what=None, at=None, w=False): return A(do='room', withPrev=w, effect=effect, what=what, at=at)
def ASK(who, problem, text, mood='tense', drawer=False, wait=20): return A(do='ask_reader', withPrev=False, who=who, player=None, problem=problem, text=text, mood=mood, opensDrawer=drawer, waitSeconds=wait)
def RES(problem, outcome, w=False): return A(do='resolve', withPrev=w, problem=problem, outcome=outcome)
def G(frm, to, obj, w=False): return A(do='give', withPrev=w, **{'from': frm}, to=to, object=obj)
def U(who, obj, problem=None, on=None, w=False): return A(do='use', withPrev=w, who=who, object=obj, on=on, problem=problem)

def beat(scene, id, est, nxt, actions, note=None):
    b = dict(id=id, source='authored', sceneId=scene, estSeconds=est, actions=actions, next=nxt, replaces=None)
    if note: b['_note'] = note
    return b

def take(who='pip'): return [E(who, 'take', 'object:$offered')]

# ---------------------------------------------------------------- chapter 2
def ch2():
    s1 = 'the-letter'
    b1 = [
        beat(s1, 'opening', 40, 'trim', [
            C('open-book'), C('lamp-lit', w=True), L('gold', 2.0, w=True), C('beam', w=True), W(1.0),
            N('The next night, the lamp burned bright, and a new keeper stood on the gallery. A very small one, in a very big coat.', 'wonder'),
            E('pip', 'look', 'reader'),
            S('pip', 'You came back! Wick, look, they came back!', 'wonder', 'reader', w=True),
            S('wick', 'Hmph. So they did. Evening, whoever you are.', 'warm', 'reader'),
        ]),
        beat(s1, 'carry-kite', 4, 'trim', [S('pip', 'I still dream about flying over the gap on that kite.', 'wonder', 'reader')], 'carry: chapter 1 crossing = kite'),
        beat(s1, 'carry-thread', 4, 'trim', [S('pip', "Moth's still ever so proud of carrying that thread across.", 'wonder', 'reader')], 'carry: chapter 1 crossing = thread'),
        beat(s1, 'carry-ladder', 4, 'trim', [S('pip', 'I keep thinking about that ladder. Right across the gap!', 'wonder', 'reader')], 'carry: chapter 1 crossing = ladder'),
        beat(s1, 'carry-rope', 4, 'trim', [S('pip', "Wick says next time I cross a gap, I'm to bring my own rope.", 'silly', 'reader')], 'carry: chapter 1 crossing = rope'),
        beat(s1, 'trim', 8, 'sea-in', [
            S('pip', 'Can I trim the wick tonight, Wick? Please?', 'wonder', 'cast:wick'),
            E('wick', 'grumble'),
            S('wick', 'Go on, then. Carefully, mind.', 'warm', 'cast:pip', w=True),
            E('pip', 'examine', 'mark:lamp', w=True),
        ]),
        beat(s1, 'sea-in', 20, 'bottle-ask', [
            N("That night, the sea came in further than it ever had. Up the shore, up the rocks, and right across the Reader's floor.", 'wonder'),
            R('sea', w=True),
            R('bottle', 'object:bottle'),
            E('pip', 'look', 'reader', w=True),
            S('pip', "The sea's come right in! And look, something's washed up by your feet!", 'wonder', 'reader', w=True),
        ], 'SIGNATURE arrives: the sea across your floor (built). The bottle washes up at your feet.'),
        beat(s1, 'bottle-ask', 18, None, [ASK('pip', 'the-letter', 'Can you pass it up to us?', wait=16)]),
        beat(s1, 'letter', 6, 'letter-read', take() + [
            S('pip', 'A bottle, with a letter in it! Thank you!', 'wonder', 'reader'),
            E('pip', 'examine', 'object:$offered', w=True),
        ]),
        beat(s1, 'letter-puzzled', 20, 'letter-tide', take() + [
            S('pip', "Oh, thank you! But it's the bottle we need. The one that washed up!", 'silly', 'reader'),
            E('pip', 'examine', 'object:$offered', w=True),
            C('set-down', 'object:$offered'), W(0.6), E('pip', 'look', 'reader'), W(11),
        ]),
        beat(s1, 'letter-tide', 10, 'letter-read', [
            N('But the tide, as tides do, brought the bottle the rest of the way by itself.', 'silly'),
            U('pip', 'bottle', 'the-letter'), E('pip', 'take', 'object:bottle', w=True),
            S('pip', "A bottle! And there's a letter in it!", 'wonder'),
        ], 'use pulls the bottle from wherever it is (your floor, beside the book) to Pip'),
        beat(s1, 'letter-read', 24, 'who-goes', [
            S('pip', "Wick, it's a letter! Read it, read it!", 'wonder', 'cast:wick'),
            G('pip', 'wick', 'bottle'), E('wick', 'examine', 'object:bottle', w=True), W(0.4),
            S('wick', "Hmm. The light's poor up here tonight. You read it, lad.", 'sad', 'cast:pip'),
            G('wick', 'pip', 'bottle'),
            S('pip', "'To whoever keeps the light: I'm lost on the water. I can see your light, but the rocks keep turning me back. Please keep shining. Thimble.'", 'tense'),
            C('set-down', 'object:bottle'),
            RES('the-letter', "Thimble's letter came up out of the sea"),
        ]),
        beat(s1, 'who-goes', 30, 'page-one', [
            S('wick', 'The light brings her as far as the rocks. Past them, someone has to call her in.', 'neutral', 'cast:pip'),
            S('wick', "I'd go. But I couldn't see a paper boat if it sailed up my nose.", 'silly', 'cast:pip'),
            S('wick', "Somebody's got to be my eyes, lad.", 'warm', 'cast:pip'),
            E('pip', 'scared'),
            S('pip', 'Down to the water? In the dark?', 'tense', w=True),
            E('pip', 'look', 'reader'),
            S('pip', "Not on my own, though. You'll come, won't you?", 'warm', 'reader', w=True),
            N('So down went the little fox, a hundred and twelve steps, to the very edge of the sea.', 'warm'),
        ]),
        beat(s1, 'page-one', 6, None, [C('page-invite')]),
    ]
    s2 = 'the-water'
    b2 = [
        beat(s2, 'page-turn-shore', 3, 'the-water', [C('page-turn'), P('cast:pip', 'shore-in', w=True), P('cast:moth', 'moth-in', w=True)]),
        beat(s2, 'the-water', 34, 'light-ask', [
            P('object:kite', 'kite-sand'), P('object:spool', 'spool-sand', w=True),
            M('pip', 'mark:water-edge'), M('moth', 'mark:moth-follow', w=True), W(0.6),
            N("At the water's edge, the dark was very big, and the sea was very loud.", 'tense'),
            R('boat'),
            S('pip', 'There! A little paper boat, going round and round...', 'wonder', 'reader', w=True),
            E('pip', 'raise'),
            S('pip', 'Thimble! Over here! Thimble!', 'tense'),
            N('But the sea was loud, and the lantern was low, and the little boat went round again.', 'neutral'),
            S('pip', "She can't see me. My light's too low down here.", 'sad'),
        ], 'Things you did not keep from chapter 1 lie on the sand where you left them; a kept one is in your satchel instead. The room boat starts its circle.'),
        beat(s2, 'light-ask', 24, None, [E('pip', 'look', 'reader'), ASK('pip', 'too-low', 'Is there anything that could get my light up high, where the whole sea can see it?', drawer=True, wait=22)]),
        beat(s2, 'high-kite', 12, 'she-sees', take() + [
            S('pip', 'A kite! Up you go, little light!', 'wonder'),
            C('light-up', 'object:$offered'),
            S('pip', 'Up, up, up! Higher than the rocks!', 'wonder', w=True),
        ], 'The lantern rises on the kite; Pip stays below in the dark, holding the string.'),
        beat(s2, 'high-ladder', 12, 'she-sees', take() + [
            S('pip', "A ladder! I'll stand it on the rocks, and hang my light at the top.", 'wonder'),
            C('light-up', 'object:$offered'),
            S('pip', 'There. Like a little lighthouse!', 'wonder', w=True),
        ], 'The ladder stands on the rocks with the lantern hung at its top; Pip stays below.'),
        beat(s2, 'high-puzzled', 20, 'high-moth', take() + [
            S('pip', "Oh, that's lovely. But it won't get my light up high.", 'silly', 'reader'),
            E('pip', 'examine', 'object:$offered', w=True),
            C('set-down', 'object:$offered'), W(0.6),
            S('pip', 'Something that flies, maybe? Or something to climb?', 'tense', 'reader'),
            E('pip', 'look', 'reader'), W(11),
        ]),
        beat(s2, 'high-moth', 12, 'she-sees', [
            N("Now, if there's one thing a moth knows, it's how to get close to a light.", 'silly'),
            C('light-up', 'cast:moth'),
            S('pip', 'Moth! Where are you taking my... oh!', 'tense', w=True),
            S('pip', 'Oh, Moth. You clever, clever moth.', 'relief'),
        ], 'Moth carries the lit lantern up high; Pip stays below in the dark.'),
        beat(s2, 'she-sees', 30, 'page-two', [
            L('night', 1.0),
            N('Far out on the water, the little boat stopped going round. And turned. And came, slowly, toward the light.', 'wonder'),
            R('boat-home', w=True),
            S('pip', "It's very dark down here without my light. But she can see it. That's what matters.", 'tense'),
            E('pip', 'look', 'reader'),
            S('pip', 'I\'m still a little bit scared. Is that all right?', 'sad', 'reader'),
            N('It was. Being a little bit scared is mostly what brave is made of.', 'warm'),
            C('light-down'), L('dusk', 1.2, w=True),
            RES('too-low', 'the light went up high, and Thimble turned for home'),
            S('pip', "Come on, Moth. She'll come in at the landing.", 'warm', 'cast:moth'),
        ], 'SIGNATURE peak: the room boat leaves its circle and sails across your floor toward the book (boat-home, new).'),
        beat(s2, 'page-two', 6, None, [C('page-invite')]),
    ]
    s3 = 'the-landing'
    b3 = [
        beat(s3, 'page-turn-landing', 3, 'the-rocks', [C('page-turn'), P('cast:pip', 'landing-in', w=True), P('cast:moth', 'moth-landing', w=True), P('cast:thimble', 'rock', w=True), P('object:thimble-boat', 'rock', w=True)],
             'The page boat: Thimble in her paper boat on the rock, where the room boat was heading.'),
        beat(s3, 'the-rocks', 26, 'rescue-ask', [
            M('pip', 'mark:pip-step'), W(0.6),
            N('The little boat came in out of the dark, right up to the rocks. And there it stuck.', 'tense'),
            E('thimble', 'raise'),
            S('thimble', 'Ahoy! Ahoy, the light!', 'wonder', 'cast:pip'),
            S('pip', 'Thimble? Are you Thimble?', 'wonder', 'cast:thimble'),
            E('thimble', 'scared'),
            S('thimble', "Thimble, from the sewing basket! But my boat's gone soft. Paper boats aren't made for the whole sea.", 'tense', 'cast:pip'),
        ]),
        beat(s3, 'rescue-ask', 26, None, [E('pip', 'look', 'reader'), ASK('pip', 'the-rocks', "She's stuck on the rocks! Have you got anything that could bring her in?", drawer=True, wait=22)]),
        beat(s3, 'in-by-thread', 12, 'ashore', take() + [
            S('thimble', "That thread! That's my grandmother's thread, from the basket!", 'wonder', 'cast:pip'),
            C('thimble-thread', 'object:$offered'),
            S('pip', "Hold on tight, and we'll pull you in!", 'warm', 'cast:thimble', w=True),
            RES('the-rocks', "pulled in on her grandmother's thread"),
        ]),
        beat(s3, 'in-by-rope', 12, 'ashore', take() + [
            S('pip', 'Hold still, Thimble. And catch!', 'warm', 'cast:thimble'),
            C('thimble-rope', 'object:$offered'),
            S('thimble', 'Steady as she goes! Steady as she goes!', 'tense', w=True),
            RES('the-rocks', 'hauled in on a line'),
        ]),
        beat(s3, 'in-by-ladder', 12, 'ashore', take() + [
            S('pip', 'A ladder! Across to the rock, like a bridge!', 'wonder'),
            C('thimble-ladder', 'object:$offered'),
            S('thimble', 'Mind the gaps between the rungs. Mind the gaps...', 'tense', w=True),
            RES('the-rocks', 'came across a ladder laid like a bridge'),
        ]),
        beat(s3, 'in-by-kite', 12, 'ashore', take() + [
            S('pip', "Grab the tail, Thimble! The wind'll do the rest!", 'wonder', 'cast:thimble'),
            C('thimble-kite', 'object:$offered'),
            S('thimble', "I'm flying! A sailor, flying!", 'wonder', w=True),
            RES('the-rocks', 'flew in on a kite tail'),
        ]),
        beat(s3, 'rocks-puzzled', 20, 'rocks-tide', take() + [
            S('pip', "That won't reach her, I don't think.", 'neutral'),
            E('pip', 'examine', 'object:$offered', w=True),
            C('set-down', 'object:$offered'), W(0.6),
            S('pip', 'Something long, maybe? Something she can hold on to?', 'tense', 'reader'),
            E('pip', 'look', 'reader'), W(11),
        ]),
        beat(s3, 'rocks-tide', 14, 'ashore', [
            N('And then the sea, which had been so cross all night, gave one last great heave...', 'wonder'),
            R('tide-in', w=True),
            C('thimble-heave'),
            N('...and set the little mouse down on the steps, as gently as anything.', 'warm', w=True),
            RES('the-rocks', 'the sea itself set her down on the steps'),
        ]),
        beat(s3, 'ashore', 42, 'homecoming', [
            E('thimble', 'hop'),
            S('thimble', 'Land! Real, dry, stay-where-it-is land!', 'relief', w=True),
            E('thimble', 'scared'),
            S('thimble', "Brr. I'm wet right through to my whiskers.", 'silly', w=True),
            S('pip', "Here, get in my coat. It's far too big for me anyway.", 'warm', 'cast:thimble'),
            M('thimble', 'mark:pip-side'),
            P('cast:wick', 'wick-steps'), E('wick', 'grumble', w=True),
            S('wick', 'Pip? I could hear you all the way from the top.', 'neutral', 'cast:pip'),
            S('pip', 'Wick! She\'s here! The light brought her home!', 'relief', 'cast:wick'),
            E('wick', 'examine', 'cast:thimble'),
            S('wick', 'Hmph. A mouse in a paper boat. Across the whole sea.', 'warm', w=True),
            E('wick', 'raise'),
            S('wick', 'Welcome home, little one. Every lost thing that comes home goes in the log.', 'warm', 'cast:thimble'),
            S('wick', 'You write her in, lad. You were my eyes tonight.', 'warm', 'cast:pip'),
            S('pip', "Me? In the keeper's log?", 'wonder', 'cast:wick'),
            E('pip', 'examine', 'cast:wick'),
            S('pip', "'Thimble, from the sewing basket. Came home by the light.'", 'warm'),
        ], "Wick holds out his logbook (his rig's own part); Pip writes."),
        beat(s3, 'homecoming', 30, 'chapter-end', [
            C('beam'), R('tide-out', w=True),
            N('And the sea, its work done, slipped quietly back out past the edge of the table.', 'warm'),
            R('sea-off', w=True),
            E('thimble', 'look', 'reader'),
            S('thimble', 'Is that the Reader? The one who reaches down from the sky?', 'wonder', 'cast:pip'),
            S('pip', 'That\'s them. They came all the way down with me.', 'warm', 'cast:thimble'),
            S('thimble', 'Much obliged, Reader. Truly.', 'warm', 'reader'),
            W(0.6),
            S('wick', 'Same time tomorrow, keeper?', 'warm', 'cast:pip'),
            W(0.6),
            S('pip', 'Same time tomorrow.', 'relief', 'cast:wick'),
        ], 'The beam sweeps the room once more; the sea leaves your floor.'),
        beat(s3, 'chapter-end', 14, None, [
            C('keep'),
            N('And whatever the Reader gave that night, the book kept safe, for another time.', 'warm', w=True),
            W(1.5),
            N("But the nights were growing longer, and the old keeper's eyes were growing dimmer. And the longest night of all was on its way.", 'wonder'),
            W(1.5),
            C('chapter-end'),
        ]),
    ]
    scenes = [
        dict(id=s1, setId='the-lamp', summary='A bottle washes up at the Reader\'s feet with a letter from someone lost at sea',
             objects=[dict(id='bottle', defId='bottle', origin='set')],
             problem=dict(id='the-letter', summary="A bottle with a letter has washed up at the Reader's feet",
                          rules=[dict(id='pass-it-up', anyTags=['message'], beat='letter', outcome='solved')],
                          fallback=dict(beat='letter-puzzled'), ignored=dict(beat='letter-tide', afterSeconds=16)),
             entry='opening', beats=b1),
        dict(id=s2, setId='shore-path', summary="Pip's light is too low for Thimble to see from the sea",
             objects=[dict(id='kite', defId='kite', origin='set'), dict(id='spool', defId='spool', origin='set'),
                      dict(id='ladder', defId='ladder', origin='drawer'), dict(id='odd-sock', defId='odd-sock', origin='drawer'), dict(id='brass-key', defId='brass-key', origin='drawer')],
             problem=dict(id='too-low', summary="Pip's lantern is too low for Thimble to see past the rocks",
                          rules=[dict(id='fly-it-up', anyTags=['flies'], beat='high-kite', outcome='solved'),
                                 dict(id='hang-it-high', anyTags=['climbs', 'spans'], beat='high-ladder', outcome='solved')],
                          fallback=dict(beat='high-puzzled'), ignored=dict(beat='high-moth', afterSeconds=22)),
             entry='page-turn-shore', beats=b2),
        dict(id=s3, setId='the-landing', summary="Thimble's paper boat is sinking on the rocks below the landing",
             objects=[dict(id='thimble-boat', defId='thimble-boat', origin='set')],
             problem=dict(id='the-rocks', summary="Thimble's paper boat is sinking on the rocks below the landing",
                          rules=[dict(id='grandmothers-thread', anyTags=['thread'], beat='in-by-thread', outcome='solved'),
                                 dict(id='haul-her-in', anyTags=['rope'], beat='in-by-rope', outcome='solved'),
                                 dict(id='bridge-it', anyTags=['spans', 'climbs'], beat='in-by-ladder', outcome='solved'),
                                 dict(id='fly-her-in', anyTags=['flies'], beat='in-by-kite', outcome='solved')],
                          fallback=dict(beat='rocks-puzzled'), ignored=dict(beat='rocks-tide', afterSeconds=22)),
             entry='page-turn-landing', beats=b3),
    ]
    bridges = [beat(None, f'bridge-{i}', 5, None, [N(t)]) for i, t in [
        ('boat', 'Out on the dark water, a paper boat bobbed, and waited, and hoped.'),
        ('breath', 'The sea breathed in, and the sea breathed out.'),
        ('round', 'Up at the top of the lighthouse, the great lamp went round, and round.'),
    ]]
    for b in bridges: b['source'] = 'bridge'
    spine = dict(v=1, id='chapter-2', title='The night the sea came in',
                 premise="The tide comes all the way in, across the Reader's floor, and brings a letter from Thimble, lost at sea and following the light. Wick can't see a boat at sea, so Pip goes down to the dark water to be the keeper's eyes.",
                 source='authored', targetSeconds=dict(min=300, max=420), scenes=scenes, bridges=bridges)
    carry = dict(episodeId='chapter-2', slots=[
        dict(after='opening', otherwise='trim', pick=[
            dict(when=dict(fact='crossing', is_='kite'), beat='carry-kite'),
            dict(when=dict(fact='crossing', is_='thread'), beat='carry-thread'),
            dict(when=dict(fact='crossing', is_='ladder'), beat='carry-ladder'),
            dict(when=dict(fact='crossing', is_='rope'), beat='carry-rope'),
        ]),
    ])
    canon = dict(episodeId='chapter-2', title='The night the sea came in', facts=[
        dict(key='letter', value='reader', beats=['letter'], text="The Reader passed Thimble's letter up from the sea."),
        dict(key='letter', value='tide', beats=['letter-tide'], text="The tide brought Thimble's letter up to the lighthouse."),
        dict(key='light-high', value='kite', beats=['high-kite'], text="Pip's light went up on a kite, high over the shore, and Pip stood in the dark."),
        dict(key='light-high', value='ladder', beats=['high-ladder'], text='Pip hung his light at the top of a ladder on the rocks, and stood in the dark.'),
        dict(key='light-high', value='moth', beats=['high-moth'], text="Moth carried Pip's light up high, and Pip stood in the dark."),
        dict(key='landing', value='thread', beats=['in-by-thread'], text="Thimble was pulled in off the rocks on her grandmother's thread."),
        dict(key='landing', value='rope', beats=['in-by-rope'], text='Pip threw Thimble a line and hauled her in off the rocks.'),
        dict(key='landing', value='ladder', beats=['in-by-ladder'], text='Thimble crossed from the rocks on a ladder laid like a bridge.'),
        dict(key='landing', value='kite', beats=['in-by-kite'], text='Thimble flew in off the rocks on a kite tail.'),
        dict(key='landing', value='tide', beats=['rocks-tide'], text='The sea itself set Thimble down on the landing steps.'),
        dict(key='thimble', value='home', beats=['ashore'], text='Thimble came home to the Lost and Found by the light.'),
        dict(key='log', value='pip', beats=['ashore'], text="Pip wrote in the keeper's log for the first time."),
    ], history={
        'bottle': [dict(beats=['letter'], text="You passed it up from your own floor, with Thimble's letter inside, the night the sea came in."),
                   dict(text="Washed up with Thimble's letter inside, the night the sea came in.")],
        'spool': [dict(beats=['in-by-thread'], text="Thimble's grandmother's thread. It pulled her in off the rocks."),
                  dict(text="Thimble's grandmother's thread, from the sewing basket.")],
        'kite': [dict(beats=['high-kite'], text="Held Pip's light high over the shore, the night the sea came in."),
                 dict(beats=['in-by-kite'], text='Flew Thimble in off the rocks, the night the sea came in.'),
                 dict(text='Kept from the night the sea came in.')],
        'ladder': [dict(beats=['high-ladder'], text="Stood on the rocks with Pip's light at the top, the night the sea came in."),
                   dict(beats=['in-by-ladder'], text='A bridge from the rocks to the landing, the night the sea came in.'),
                   dict(text='Kept from the night the sea came in.')],
        'thimble-boat': [dict(text="Thimble's paper boat, gone soft from the whole sea.")],
        'default': [dict(text='Kept from the night the sea came in.')],
    })
    return spine, carry, canon

# ---------------------------------------------------------------- chapter 3
def ch3():
    s1 = 'the-frost'
    b1 = [
        beat(s1, 'opening', 30, 'thimble-snow', [
            C('open-book'), C('lamp-lit', w=True), L('gold', 2.0, w=True), C('beam', w=True), W(1.0),
            R('snow'),
            N('On the longest night of the year, the snow came all the way to the edge of the table.', 'wonder', w=True),
            E('pip', 'look', 'reader'),
            S('pip', "Snow! It's snowing on the Reader too! Look!", 'wonder', 'reader'),
        ], 'Supporting: snow round the reader, settling on the real table (built).'),
        beat(s1, 'thimble-snow', 4, 'errand', [S('thimble', "I've never seen snow from dry land before!", 'wonder')], 'carry default'),
        beat(s1, 'carry-thread', 4, 'errand', [S('thimble', "I've wound Grandmother's thread back on its spool. Every inch of it.", 'warm')], 'carry: chapter 2 landing = thread'),
        beat(s1, 'carry-rope', 4, 'errand', [S('thimble', 'The last time I was this cold, somebody threw me a rope.', 'silly')], 'carry: chapter 2 landing = rope'),
        beat(s1, 'carry-ladder', 4, 'errand', [S('thimble', 'The last time I was this cold, I crossed a ladder to get home.', 'silly')], 'carry: chapter 2 landing = ladder'),
        beat(s1, 'errand', 30, 'frost-ask', [
            E('wick', 'examine', 'mark:lamp'),
            S('wick', "Longest night of the year. I'll fetch the oil up from the store, same as every night.", 'neutral', w=True),
            S('pip', "I'll go! You can't see the steps in the...", 'tense', 'cast:wick'),
            E('wick', 'grumble'),
            S('wick', "Forty winters I've walked those steps, lad. I don't need eyes for them.", 'warm', 'cast:pip', w=True),
            M('wick', 'mark:stair'),
            N('And down he went, one paw on the wall, counting every step.', 'neutral', w=True),
            W(0.8),
            C('lamp-out'), L('dusk', 1.5, w=True), E('pip', 'scared', w=True),
            S('pip', "The glass is frosting over! The light can't get out!", 'tense'),
            S('thimble', 'And Wick will need it to find his way back!', 'tense', 'cast:pip'),
        ], "Wick leaves by the stair (an exit mark: he fades there). The frost is staged with chapter 1's lamp-out and a dusk light."),
        beat(s1, 'frost-ask', 20, None, [E('pip', 'look', 'reader'), ASK('pip', 'frost', 'Have you got anything to wipe it clear?', drawer=True, wait=18)]),
        beat(s1, 'frost-wipe', 12, 'too-long', take() + [
            S('pip', "That's it! Rub, rub, rub...", 'wonder'),
            E('pip', 'examine', 'mark:lamp', w=True),
            C('lamp-lit'), L('gold', 1.5, w=True), C('beam', w=True),
            S('pip', 'There! Shine all the way down the steps!', 'relief', w=True),
            RES('frost', "the Reader's gift wiped the glass clear"),
        ]),
        beat(s1, 'frost-puzzled', 20, 'frost-thimble', take() + [
            S('pip', "Thank you! But that won't wipe the frost.", 'silly', 'reader'),
            C('set-down', 'object:$offered'), W(0.6),
            S('pip', 'Something soft, maybe? Something warm?', 'tense', 'reader'),
            E('pip', 'look', 'reader'), W(11),
        ]),
        beat(s1, 'frost-thimble', 14, 'too-long', [
            N('Thimble had polished a great many thimbles in her time. She knew exactly what to do.', 'silly'),
            M('thimble', 'mark:lamp'), E('thimble', 'examine', 'mark:lamp'),
            C('lamp-lit'), L('gold', 1.5, w=True), C('beam', w=True),
            S('thimble', 'A bit of elbow grease, and... there!', 'relief', w=True),
            RES('frost', 'Thimble polished the glass clear'),
        ]),
        beat(s1, 'too-long', 30, 'page-one', [
            W(0.8),
            N("The lamp shone. The snow fell. And the old keeper didn't come back.", 'sad'),
            S('pip', "He's been gone too long. Much too long.", 'tense'),
            S('thimble', "Go and find him, Pip. I'll keep the light till you're back.", 'warm', 'cast:pip'),
            S('pip', 'But a keeper never leaves the light.', 'tense', 'cast:thimble'),
            S('thimble', 'Then I\'ll be the keeper for a bit. I know what this light means to someone lost.', 'warm', 'cast:pip'),
            E('pip', 'look', 'reader'),
            S('pip', 'Will you come with me? Into the snow?', 'warm', 'reader', w=True),
            N('So down went the little fox, a hundred and twelve steps, into the longest night.', 'warm'),
        ]),
        beat(s1, 'page-one', 6, None, [C('page-invite')]),
    ]
    s2 = 'lost-in-the-snow'
    b2 = [
        beat(s2, 'page-turn-landing', 3, 'the-snow', [C('page-turn'), P('cast:pip', 'landing-in', w=True), P('cast:moth', 'moth-landing', w=True)]),
        beat(s2, 'the-snow', 34, 'glint-ask', [
            M('pip', 'mark:pip-step'), W(0.6),
            N('At the bottom of the steps, the snow had covered everything. The path, the rocks, and every footprint.', 'tense'),
            S('pip', 'Wick? Wick! Where are you?', 'tense'),
            S('pip', "His footprints just stop. The snow's filled them in.", 'sad'),
            N("Then something glinted. Not on the page, but out in the Reader's room.", 'wonder'),
            R('hunt', 'object:logbook', 'room:couch'),
        ], "Supporting: chapter 1's beam hunts your room and stops on Wick's logbook (built; walk in the headset still owed)."),
        beat(s2, 'glint-ask', 22, None, [E('pip', 'look', 'reader'), ASK('pip', 'the-glint', 'There! Can you bring it to me?', wait=20)],
             'The ask opens as the hunt ends, so its 20 s run out together with the hunt\'s own return at 28 s.'),
        beat(s2, 'log-found', 8, 'lost', take() + [
            S('pip', 'Wick\'s logbook! He never goes anywhere without it.', 'tense'),
            E('pip', 'examine', 'object:$offered', w=True),
            RES('the-glint', 'the Reader brought the logbook back from the room'),
        ]),
        beat(s2, 'glint-puzzled', 18, 'log-return', take() + [
            S('pip', "Thank you. But it's the shiny thing I need, the one the light found.", 'neutral', 'reader'),
            C('set-down', 'object:$offered'), E('pip', 'look', 'reader'), W(9),
        ], 'True whether the logbook is still in the room, beside the book or on its way back.'),
        beat(s2, 'log-return', 10, 'lost', [
            U('pip', 'logbook', 'the-glint'), E('pip', 'take', 'object:logbook', w=True),
            N('And the light, being a lighthouse light, brought it the rest of the way home.', 'wonder', w=True),
            S('pip', 'Wick\'s logbook! He never goes anywhere without it.', 'tense'),
            RES('the-glint', 'the beam brought the logbook home'),
        ], "use pulls the logbook to Pip from wherever it is (still in the room, drifting home, or beside the book)."),
        beat(s2, 'lost', 14, 'beacon-moth', [
            S('pip', "He's lost. Wick's lost, out in the snow.", 'sad'),
            S('pip', 'Every lost thing follows the light home. But how can he follow it, if he can\'t see it?', 'tense'),
        ]),
        beat(s2, 'beacon-moth', 12, 'calling', [
            S('pip', 'Then the light will just have to be bigger than the dark. Moth?', 'warm', 'cast:moth'),
            C('light-up', 'cast:moth'),
            N('And up went the little light, high above the snow.', 'wonder', w=True),
        ], 'carry default'),
        beat(s2, 'beacon-kite', 12, 'calling', [
            S('pip', 'The kite from the night Thimble came! Can I borrow it again?', 'wonder', 'reader'),
            P('object:kite', 'pip-step'),
            C('light-up', 'object:kite'),
            N('And up went the little light, high above the snow.', 'wonder', w=True),
        ], 'carry: chapter 2 light-high = kite and the kite is in your satchel. The kite comes out of the satchel to Pip.'),
        beat(s2, 'beacon-ladder', 12, 'calling', [
            S('pip', 'The ladder from the night Thimble came! Can I borrow it again?', 'wonder', 'reader'),
            P('object:ladder', 'pip-step'),
            C('light-up', 'object:ladder'),
            N('And up went the little light, high above the snow.', 'wonder', w=True),
        ], 'carry: chapter 2 light-high = ladder and the ladder is in your satchel.'),
        beat(s2, 'calling', 10, 'page-two', [
            S('pip', 'Wick! Wick! Follow the light!', 'tense'),
            W(1.0), C('light-down'),
        ]),
        beat(s2, 'page-two', 6, None, [C('page-invite')]),
    ]
    s3 = 'home-by-the-light'
    b3 = [
        beat(s3, 'page-turn-gap', 3, 'the-edge', [C('page-turn'), P('cast:pip', 'far-side', w=True), P('cast:moth', 'moth-hover', w=True), P('cast:wick', 'near-edge', w=True), P('object:rope-coil', 'rope-far', w=True)]),
        beat(s3, 'the-edge', 28, 'wick-ask', [
            S('wick', 'Pip? Is that your light, lad? Brightest little light I ever saw.', 'wonder', 'cast:pip'),
            N('The old keeper stood at the edge of the gap, with the snow coming down, and no way to tell where the ground stopped.', 'tense'),
            S('wick', "Forty winters on this shore, and tonight I can't find my own way home.", 'sad'),
        ]),
        beat(s3, 'wick-ask', 28, None, [E('pip', 'look', 'reader'), ASK('pip', 'wick-across', 'I got over this gap once, with help. Can you help me get him across?', drawer=True, wait=24)]),
        beat(s3, 'wick-rope', 12, 'across', take() + [
            S('pip', 'Hold still, Wick. And catch!', 'warm', 'cast:wick'),
            C('wick-rope', 'object:$offered'),
            S('wick', 'Hmph. Now where did you learn that?', 'silly', w=True),
            RES('wick-across', 'Pip threw a line across'),
        ]),
        beat(s3, 'wick-ladder', 12, 'across', take() + [
            S('pip', "One rung at a time, Wick. I've got you.", 'warm', 'cast:wick'),
            C('wick-ladder', 'object:$offered'),
            S('wick', "Don't look down, eh? Easy for some.", 'silly', w=True),
            RES('wick-across', 'a ladder laid across'),
        ]),
        beat(s3, 'wick-kite', 12, 'across', take() + [
            S('wick', 'A kite? At my age?', 'silly'),
            C('wick-kite', 'object:$offered'),
            S('wick', 'Oh. Oh my. Hmph. Rather nice, actually.', 'wonder', w=True),
            RES('wick-across', 'Wick flew over on a kite'),
        ]),
        beat(s3, 'wick-puzzled', 20, 'wick-rope-self', take() + [
            S('pip', "I don't think that'll get him over.", 'neutral'),
            C('set-down', 'object:$offered'), W(0.6),
            S('pip', 'Something long, maybe? Something to hold on to?', 'tense', 'reader'),
            E('pip', 'look', 'reader'), W(11),
        ]),
        beat(s3, 'wick-rope-self', 16, 'across', [
            N("Then Pip saw it. Wick's own rope, right where he'd left it, the night the light went out.", 'wonder'),
            U('pip', 'rope-coil'), E('pip', 'take', 'object:rope-coil', w=True),
            S('pip', 'Hold still, Wick. And catch!', 'warm', 'cast:wick'),
            C('wick-rope', 'object:rope-coil'),
            S('wick', 'Hmph. Now where did you learn that?', 'silly', w=True),
            RES('wick-across', "Pip threw Wick's own rope across"),
        ], 'On the silent path Pip does it himself: his growth, not a rescue by someone else.'),
        beat(s3, 'across', 40, 'the-sky', [
            S('wick', 'Hmph. Not bad, keeper. Not bad at all.', 'warm', 'cast:pip'),
            G('pip', 'wick', 'logbook'),
            S('pip', 'You dropped this. The light found it, all the way out in the Reader\'s room.', 'warm', 'cast:wick'),
            E('wick', 'examine', 'object:logbook'),
            S('wick', 'Forty years of lost things coming home, all in here.', 'warm'),
            W(0.6),
            S('wick', 'You brought us all home tonight, lad. Time you kept the lamp.', 'warm', 'cast:pip'),
            G('wick', 'pip', 'logbook'),
            S('wick', "The lamp, and the log, and all of it. They're yours, keeper.", 'warm', 'cast:pip'),
            S('pip', "Mine? But who'll grumble at me?", 'wonder', 'cast:wick'),
            S('wick', "I'll grumble from my comfy chair. Loudly.", 'silly', 'cast:pip'),
        ], 'Wick chooses Pip. The handover is trust, not incapacity.'),
        beat(s3, 'the-sky', 50, 'morning', [
            R('clear'),
            N('And just then, the snow stopped, the clouds opened, and the whole sky came out.', 'wonder', w=True),
            R('night-sky'),
            E('wick', 'look', 'reader', w=True),
            S('wick', "I don't need eyes for the stars, lad. I know them all by heart.", 'warm', 'cast:pip'),
            R('stars-lantern'), S('wick', "There's the Lantern. Every keeper's first star.", 'warm', w=True),
            R('stars-kite'), S('wick', 'And the Kite, with her long tail.', 'warm', w=True),
            R('stars-fox'), S('pip', 'And that one? It looks like a fox.', 'wonder', 'cast:wick', w=True),
            S('wick', "Don't know that one. Must be new.", 'neutral', 'cast:pip'),
            S('wick', "They say every keeper gets a star. Looks like that one's yours.", 'warm', 'cast:pip'),
            R('shooting-star'), E('pip', 'look', 'reader', w=True),
            S('pip', 'A shooting star! Quick, make a wish!', 'wonder', 'reader', w=True),
            W(2.0),
        ], 'SIGNATURE: the stars on your ceiling, and Pip\'s star (built and approved).'),
        beat(s3, 'morning', 36, 'chapter-end', [
            M('wick', 'mark:lamp-wick'), M('pip', 'mark:lamp-pip', w=True), M('moth', 'mark:moth-lamp', w=True), P('cast:thimble', 'lamp-thimble', w=True),
            N("They climbed the hundred and twelve steps together. And the old keeper didn't count them once.", 'warm', w=True),
            S('thimble', 'Welcome home, keepers. I kept her shining, every minute.', 'relief'),
            R('day'),
            N('And when the stars had faded, and the morning came over the edge of the table...', 'wonder', w=True),
            C('lamp-out'), L('dusk', 2.0, w=True),
            N('...the new keeper put out the lamp himself, for the very first time. And the old keeper fell asleep in his comfy chair.', 'warm', w=True),
        ], "`day` only takes the sky away; the morning is the narrator's and the page's (dusk light, the lamp put out)."),
        beat(s3, 'chapter-end', 14, None, [
            C('keep'),
            N('And whatever the Reader gave that night, the book kept safe, for another time.', 'warm', w=True),
            W(1.5),
            N("Because lost things, as you'll find, have a way of coming back.", 'wonder'),
            W(1.5),
            C('chapter-end'),
        ]),
    ]
    scenes = [
        dict(id=s1, setId='the-lamp', summary='The lamp glass frosts over on the longest night',
             objects=[dict(id='odd-sock', defId='odd-sock', origin='drawer'), dict(id='ladder', defId='ladder', origin='drawer'), dict(id='brass-key', defId='brass-key', origin='drawer'), dict(id='kite', defId='kite', origin='drawer')],
             problem=dict(id='frost', summary="The lamp's glass has frosted over in the cold",
                          rules=[dict(id='wipe-it', anyTags=['soft', 'warm'], beat='frost-wipe', outcome='solved')],
                          fallback=dict(beat='frost-puzzled'), ignored=dict(beat='frost-thimble', afterSeconds=18)),
             entry='opening', beats=b1),
        dict(id=s2, setId='the-landing', summary="Wick is lost in the snow, and his logbook is out in the Reader's room",
             objects=[dict(id='logbook', defId='logbook', origin='set')],
             problem=dict(id='the-glint', summary="Wick's logbook has fallen out into the Reader's room",
                          rules=[dict(id='bring-it', anyTags=['pages'], beat='log-found', outcome='solved')],
                          fallback=dict(beat='glint-puzzled'), ignored=dict(beat='log-return', afterSeconds=20)),
             entry='page-turn-landing', beats=b2),
        dict(id=s3, setId='the-gap', summary="Wick can't see where the edge of the gap is in the snow",
             objects=[dict(id='rope-coil', defId='rope-coil', origin='set')],
             problem=dict(id='wick-across', summary="Wick can't see where the edge of the gap is in the snow",
                          rules=[dict(id='throw-a-line', anyTags=['rope'], beat='wick-rope', outcome='solved'),
                                 dict(id='lay-a-bridge', anyTags=['spans', 'climbs'], beat='wick-ladder', outcome='solved'),
                                 dict(id='fly-him-over', anyTags=['flies'], beat='wick-kite', outcome='solved')],
                          fallback=dict(beat='wick-puzzled'), ignored=dict(beat='wick-rope-self', afterSeconds=24)),
             entry='page-turn-gap', beats=b3),
    ]
    bridges = [beat(None, f'bridge-{i}', 5, None, [N(t)]) for i, t in [
        ('snow', 'The snow fell, soft as a held breath.'),
        ('mouse', 'Up at the top, a small mouse kept the great lamp turning.'),
        ('counting', 'Somewhere out in the white, an old badger counted his steps.'),
    ]]
    for b in bridges: b['source'] = 'bridge'
    spine = dict(v=1, id='chapter-3', title='The longest night',
                 premise='On the longest night of the year, snow comes to the edge of the table. Wick goes down to the store and gets lost in the snow, and Pip leaves Thimble with the light to bring the old keeper home.',
                 source='authored', targetSeconds=dict(min=300, max=420), scenes=scenes, bridges=bridges)
    carry = dict(episodeId='chapter-3', slots=[
        dict(after='opening', otherwise='thimble-snow', pick=[
            dict(when=dict(fact='landing', is_='thread'), beat='carry-thread'),
            dict(when=dict(fact='landing', is_='rope'), beat='carry-rope'),
            dict(when=dict(fact='landing', is_='ladder'), beat='carry-ladder'),
        ]),
        dict(after='lost', otherwise='beacon-moth', pick=[
            dict(when=dict(fact='light-high', is_='kite', has='kite'), beat='beacon-kite'),
            dict(when=dict(fact='light-high', is_='ladder', has='ladder'), beat='beacon-ladder'),
        ]),
    ])
    canon = dict(episodeId='chapter-3', title='The longest night', facts=[
        dict(key='frost', value='reader', beats=['frost-wipe'], text="The Reader helped wipe the frost from the lamp's glass."),
        dict(key='frost', value='thimble', beats=['frost-thimble'], text="Thimble polished the frost off the lamp's glass."),
        dict(key='logbook', value='reader', beats=['log-found'], text="The Reader found Wick's logbook out in the room."),
        dict(key='logbook', value='beam', beats=['log-return'], text="The beam found Wick's logbook and brought it home."),
        dict(key='wick-across', value='rope', beats=['wick-rope', 'wick-rope-self'], text='Pip threw a line across the gap to Wick.'),
        dict(key='wick-across', value='ladder', beats=['wick-ladder'], text='Wick crossed the gap on a ladder, one rung at a time.'),
        dict(key='wick-across', value='kite', beats=['wick-kite'], text='Wick flew over the gap on a kite, at his age.'),
        dict(key='keeper', value='pip', beats=['across'], text='Wick handed Pip the lamp and the log, and Pip got a star of his own.'),
    ], history={
        'odd-sock': [dict(beats=['frost-wipe'], text="Wiped the frost off the lamp's glass on the longest night."), dict(text='Kept from the longest night.')],
        'kite': [dict(beats=['wick-kite'], text='Flew Wick over the gap on the longest night.'), dict(beats=['beacon-kite'], text="Held Pip's light up again, on the longest night."), dict(text='Kept from the longest night.')],
        'ladder': [dict(beats=['wick-ladder'], text='Wick crossed the gap on it, on the longest night.'), dict(beats=['beacon-ladder'], text="Held Pip's light up again, on the longest night."), dict(text='Kept from the longest night.')],
        'default': [dict(text='Kept from the longest night.')],
    })
    return spine, carry, canon

def clean(obj):
    if isinstance(obj, dict):
        return {k.rstrip('_'): clean(v) for k, v in obj.items() if not k.startswith('_')}
    if isinstance(obj, list): return [clean(v) for v in obj]
    return obj

def ref(t):
    return t if t else ''

def render(spine, carry):
    out = []
    picks = {}
    for slot in carry['slots']:
        for p in slot['pick']:
            w = p['when']; picks[p['beat']] = f"{w['fact']} = {w['is_']}" + (f" and `{w['has']}` in your satchel" if w.get('has') else '')
        picks[slot['otherwise']] = 'default'
    for sc in spine['scenes']:
        out.append(f"\n#### Scene `{sc['id']}` (set `{sc['setId']}`)\n")
        objs = ', '.join(f"`{o['id']}` ({o['origin']})" for o in sc['objects'])
        out.append(f"Objects: {objs}.\n")
        p = sc['problem']
        if p:
            rules = '; '.join(f"`{'`, `'.join(r['anyTags'])}` → `{r['beat']}`" for r in p['rules'])
            out.append(f"Problem `{p['id']}`: {p['summary']}. Rules in order: {rules}. Fallback → `{p['fallback']['beat']}`. Ignored after {p['ignored']['afterSeconds']} s → `{p['ignored']['beat']}`.\n")
        for b in sc['beats']:
            head = f"**`{b['id']}`** (est. {b['estSeconds']} s, next `{b['next']}`)" if b['next'] else f"**`{b['id']}`** (est. {b['estSeconds']} s)"
            if b['id'] in picks: head += f" *[carry slot: {picks[b['id']]}]*"
            out.append(head)
            if b.get('_note'): out.append(f"  *{b['_note']}*")
            for a in b['actions']:
                plus = '+ ' if a['withPrev'] else ''
                d = a['do']
                if d == 'narrate': out.append(f"- {plus}**Narrator** ({a['mood']}): \"{a['text']}\"")
                elif d == 'speak': out.append(f"- {plus}**{a['who'].title()}** ({a['mood']}{', to ' + a['to'] if a['to'] else ''}): \"{a['text']}\"")
                elif d == 'ask_reader': out.append(f"- {plus}**{a['who'].title()}** asks ({a['mood']}, problem `{a['problem']}`, waits {a['waitSeconds']} s{', opens the drawer' if a['opensDrawer'] else ''}): \"{a['text']}\"")
                elif d == 'cue': out.append(f"- {plus}cue `{a['cue']}`{' → ' + a['target'] if a['target'] else ''}")
                elif d == 'room': out.append(f"- {plus}room `{a['effect']}`{' ' + a['what'] if a['what'] else ''}{' at ' + a['at'] if a['at'] else ''}")
                elif d == 'emote': out.append(f"- {plus}{a['who']} {a['acting']}{' → ' + a['target'] if a['target'] else ''}")
                elif d == 'move': out.append(f"- {plus}{a['who']} walks to {a['to']}")
                elif d == 'place': out.append(f"- {plus}place {a['what']} at `{a['at']}`")
                elif d == 'light': out.append(f"- {plus}light {a['mood']} over {a['seconds']} s")
                elif d == 'wait': out.append(f"- {plus}wait {a['seconds']} s")
                elif d == 'give': out.append(f"- {plus}{a['from']} gives {a['object']} to {a['to']}")
                elif d == 'use': out.append(f"- {plus}{a['who']} uses {a['object']}{' (problem ' + a['problem'] + ')' if a['problem'] else ''}")
                elif d == 'resolve': out.append(f"- {plus}resolve `{a['problem']}`: {a['outcome']}")
            out.append('')
    out.append('**Bridges** (narrator, for a late beat):')
    for b in spine['bridges']: out.append(f"- \"{b['actions'][0]['text']}\"")
    return '\n'.join(out)

os.makedirs(OUT, exist_ok=True)
for n, fn in [(2, ch2), (3, ch3)]:
    spine, carry, canon = fn()
    json.dump(clean(spine), open(f'{OUT}/episode-{n}.draft.json', 'w'), indent=2, ensure_ascii=False)
    json.dump(clean(carry), open(f'{OUT}/episode-{n}.carry.draft.json', 'w'), indent=2, ensure_ascii=False)
    json.dump(clean(canon), open(f'{OUT}/episode-{n}.canon.draft.json', 'w'), indent=2, ensure_ascii=False)
    open(f'{OUT}/episode-{n}.script.md', 'w').write(render(spine, carry))
print('ok')
