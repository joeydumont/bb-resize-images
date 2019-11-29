// Create a client to read objects from S3
const AWS = require('aws-sdk');
const s3 = new AWS.S3({
    signatureVersion: 'v4'
});
AWS.config.logger = console.log

// Libraries for image resize.
const s3s = require('s3-streams')
const util = require('util');
const stream = require('stream');
const sharp = require('sharp');

const readStreamFromS3 = ({Bucket, Key}) => {
    return s3s.ReadStream(s3, {
        Bucket: Bucket,
        Key: Key,
    })
};

const writeStreamToS3 = ({Bucket, Key}) => {
    return s3s.WriteStream(s3, {
        Bucket: Bucket,
        Key: Key,
        ContentType: 'image/jpeg',
    })
};

const resizeStream = ({width, height}) => {
    return sharp()
        .resize(width, height)
        .max()
        .toFormat('jpeg');
};

/**
  * A Lambda function that copies the uploaded file to another prefix, then resizes it
  */
exports.resizeImagesHandler = async (event, context) => {
    const getObjectRequests = event.Records.map(async (record) => {
        const params = {
            Bucket: record.s3.bucket.name,
            Key: record.s3.object.key,
        };

        try {
            // Determine the new path, and log them in the console.
            const fileExt = record.s3.object.key.split('.').pop();
            const splitKey = record.s3.object.key.split('/');
            const prefix = splitKey.splice(-1, 0, "orig");
            const newKey = 'orig/' + params['Key']; //splitKey.join('/');

            console.log('File extension: ' + fileExt);
            console.log('Split key:' + splitKey);
            console.log('newKey: ' + newKey);
            console.log('params', {...params})

            // Pipeline to copy the original S3 object to a different location.
            console.log('Defining read stream.')
            const pipeline = util.promisify(stream.pipeline)
            const readStreamOrig = readStreamFromS3(params);

            console.log('Defining write stream.')
            const writeStreamOrig = writeStreamToS3({Bucket: params['Bucket'], Key: newKey})

            console.log('Initiating the pipe')
            await pipeline(readStreamOrig, writeStreamOrig)
            
            // Pipeline to resize the original file and write the new in the original upload location.
            console.log('Defining read stream for resize')
            const pipelineResize = util.promisify(stream.pipeline)
            const readStream = readStreamFromS3({Bucket: params['Bucket'], Key: newKey});
            
            console.log('Defining resize stream')
            const resizeStreamVar = resizeStream({width: 500, height: 500});

            console.log('Defining write stream for resize')
            const writeStream = writeStreamToS3(params);

            // Trigger the stream.
            console.log('Trigger resize stream')
            await pipelineResize(readStream, resizeStreamVar, writeStream)

        } catch (error) {
            console.log('Error : ' + error);
            console.error('Error :' + error);
            throw error;
        }
    });

    await Promise.all(getObjectRequests);
};
