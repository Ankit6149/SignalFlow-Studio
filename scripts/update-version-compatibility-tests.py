from pathlib import Path


def replace_once(source: str, before: str, after: str, label: str) -> str:
    count = source.count(before)
    if count != 1:
        raise RuntimeError(f"Expected one {label}, found {count}")
    return source.replace(before, after, 1)


def replace_optional_once(source: str, before: str, after: str, label: str) -> str:
    count = source.count(before)
    if count > 1:
        raise RuntimeError(f"Expected at most one {label}, found {count}")
    return source.replace(before, after, 1) if count == 1 else source


page_path = Path("frontend/app/page.js")
page = page_path.read_text()
page = replace_once(
    page,
    '''                    </header>                      </span>
                    </header>''',
    '''                    </header>''',
    "review header closing boundary",
)
page = replace_once(
    page,
    '''                  {OFFICIAL_CONNECTORS.has(activeChannel) && !canPublishCurrent && (                  {OFFICIAL_CONNECTORS.has(activeChannel) && !canPublishCurrent && (''',
    '''                  {OFFICIAL_CONNECTORS.has(activeChannel) && !canPublishCurrent && (''',
    "official connector review boundary",
)
page = replace_optional_once(
    page,
    '''    if (isOverLimit) {    if (isOverLimit) {''',
    '''    if (isOverLimit) {''',
    "publish limit boundary",
)
page_path.write_text(page)

state_path = Path("frontend/tests/campaignState.test.mjs")
state = state_path.read_text()
state = replace_once(
    state,
    '''  assert.deepEqual(after, {
    ...before,
    stage: "review",
    result: payload.result,
    generationRun: payload.generationRun,
    posts: payload.posts,
    activeChannel: "x",
  });
  assert.deepEqual(before.posts, { linkedin: "Existing manual edit" });''',
    '''  assert.equal(after.stage, "review");
  assert.deepEqual(after.result, payload.result);
  assert.deepEqual(after.generationRun, payload.generationRun);
  assert.deepEqual(after.posts, payload.posts);
  assert.deepEqual(after.generatedPosts, payload.posts);
  assert.equal(after.activeChannel, "x");
  assert.equal(after.channelStates.x.edited, false);
  assert.equal(after.channelStates.x.approved, false);
  assert.equal(after.revision, before.revision + 1);
  assert.equal(after.savedRevision, null);
  assert.deepEqual(before.posts, { linkedin: "Existing manual edit" });''',
    "atomic generation assertions",
)
state_path.write_text(state)

freshness_path = Path("frontend/tests/campaignFreshness.test.mjs")
freshness = freshness_path.read_text()
freshness = replace_once(
    freshness,
    '''  assert.match(page, /disabled=\{isCampaignStale \|\| !currentPost\}/);
  assert.match(page, /disabled=\{isCampaignStale\}/);''',
    '''  assert.match(page, /disabled=\{Boolean\(campaignStatus\.copyBlockedReason\) \|\| !currentPost\}/);
  assert.match(page, /disabled=\{Boolean\(campaignStatus\.exportBlockedReason\)\}/);
  assert.match(page, /publishAvailability\.ready/);''',
    "freshness action guards",
)
freshness_path.write_text(freshness)
