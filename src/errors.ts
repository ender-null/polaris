export class ErrorMessages {
  adminEequired?: string;
  apiLimitExceeded?: string;
  connectionError?: string;
  downloadFailed?: string;
  exceptionFound?: string;
  failed?: string;
  groupOnly?: string;
  idiotKicked?: string;
  invalidArgument?: string;
  invalidSyntax?: string;
  missingId?: string;
  missingParameter?: string;
  needsReply?: string;
  noResults?: string;
  notImplemented?: string;
  permissionRequired?: string;
  privateOnly?: string;
  spammerDetected?: string;
  unknown?: string;
}

export class Errors extends ErrorMessages {
  static adminEequired = 'Only works with <b>admin privileges</b>';
  static apiLimitExceeded = 'The API limits have been exceeded';
  static connectionError = 'Connection error';
  static downloadFailed = 'Download failed';
  static exceptionFound = 'Exception found';
  static failed = 'Failed';
  static groupOnly = 'Only works with <b>groups</b>';
  static idiotKicked = 'Idiot kicked';
  static invalidArgument = 'Invalid argument';
  static invalidSyntax = 'Invalid syntax';
  static missingId = 'Missing ID';
  static missingParameter = 'Missing parameter';
  static needsReply = 'Only works with <b>replies</b>';
  static noResults = 'No results';
  static notImplemented = 'Function not implemented';
  static permissionRequired = 'Permission required';
  static privateOnly = 'Only works in <b>private</b>';
  static spammerDetected = 'Spammer detected, proceed to commit death';
  static unknown = 'Unknown';
}
