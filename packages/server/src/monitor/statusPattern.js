// "2xx" / "2xx,3xx" / "200,201,204" のようなパターン文字列に対して、
// 与えられたHTTPステータスコードが「正常」に該当するかを判定する。
export function isStatusExpected(httpStatus, pattern) {
  const tokens = pattern.split(',').map((token) => token.trim()).filter(Boolean);

  return tokens.some((token) => {
    const rangeMatch = /^(\d)xx$/i.exec(token);
    if (rangeMatch) {
      return Math.floor(httpStatus / 100) === Number(rangeMatch[1]);
    }
    return Number(token) === httpStatus;
  });
}
